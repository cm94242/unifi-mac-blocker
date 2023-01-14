const fs = require('fs')
const unifi = require('node-unifi')
const commander = require("commander");

function dump_state(config, macs) {
    const state = {
        state: macs.length === 0 ? "OFF" : "ON",
        macs
    }
    fs.writeFileSync(config.statefile, JSON.stringify(state, null, 4))
}

async function get_blocks(controller, config) {
    const devices = await controller.getClientDevices()

    const selectors = [
        (v) => (config.names || []).includes(v.name),
        (v) => (config.essids || []).includes(v.essid),
        (v) => (config.networks || []).includes(v.network),
        (v) => (config.macs || []).includes(v.mac),
    ]

    const selector = (d) => selectors.some(s => s(d))

    return devices.filter(selector)
}

function is_active(config) {
    if (fs.existsSync(config.statefile)) {
        const state = JSON.parse(fs.readFileSync(config.statefile))
        return state.state === 'ON'
    }

    return false
}

async function unblock(controller, config) {
    const configured = await get_blocks(controller, config)
    const victims = await controller.getBlockedUsers()
    for (const victim of victims) {
        console.log(`Unblocking: ${victim.name}/${victim.mac}`)
        await controller.unblockClient(victim.mac)
    }
    dump_state(config, [])
}

async function block(controller, config) {
    if (is_active(config)) {
        return
    }
    const victims = await get_blocks(controller, config)
    dump_state(config, victims.map(v => v.mac))
    for (const victim of victims) {
        console.log(`Blocking: ${victim.name}/${victim.mac}`)
        await controller.blockClient(victim.mac)
    }
}

function state(controller, config) {
    console.log(is_active(config) ? "ON" : "OFF")
}

function get_args() {
    return commander
        .version('0.0.1')
        .arguments('<cmd>')
        .option("-c, --config <path>", "Configuration file", `${process.env.HOME}/.config/mac-blocker.json`)
        .parse(process.argv)
}

async function run_in_session(config, fxn) {
    const controller = new unifi.Controller(config.controller)
    const loginData = await controller.login()
    try {
        return await fxn(controller, config)
    } finally {
        controller.logout()
    }
}

async function main() {
    const args = get_args()
    const cmd = args.args.length === 0 ? 'help' : args.args[0]
    const config = JSON.parse(fs.readFileSync(args.config))
    config.statefile = `${args.config}.statefile`

    switch (cmd) {
        case 'block':
            await run_in_session(config, block)
            break
        case 'unblock':
            await run_in_session(config, unblock)
            break
        case 'state':
            await run_in_session(config, state)
            break
        default:
            console.log(`<block|unblock|state> [-c config.json]`)
            process.exit(1)
    }
}

main()