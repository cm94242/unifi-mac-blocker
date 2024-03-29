const fs = require('fs')
const unifi = require('node-unifi')
const commander = require("commander");

async function get_blocks(controller, config) {
    const devices = await controller.getClientDevices()

    const normalize = (label) => {
        return (config[label] || []).map(v => v.toUpperCase())
    }

    const selectors = [
        (v) => normalize('names').includes(v?.name?.toUpperCase()),
        (v) => normalize('essids').includes(v?.essid?.toUpperCase()),
        (v) => normalize('networks').includes(v?.network?.toUpperCase()),
    ]

    const selector = (d) => selectors.some(s => s(d))

    return devices.filter(selector)
}

async function unblock(controller, config) {
    const direct = (config.macs || [])
    for (const mac of direct) {
        console.log(`Unblocking: ${mac}`)
        await controller.unblockClient(mac)
    }	

    const victims = await controller.getBlockedUsers()
    for (const victim of victims) {
        console.log(`Unblocking: ${victim.name}/${victim.mac}`)
        await controller.unblockClient(victim.mac)
    }
}

async function block(controller, config) {
    const victims = await get_blocks(controller, config)
    for (const victim of victims) {
        console.log(`Blocking: ${victim.name}/${victim.mac}`)
        await controller.blockClient(victim.mac)
    }

    const direct = (config.macs || [])
    for (const mac of direct) {
        console.log(`Blocking: ${mac}`)
        await controller.blockClient(mac)
    }	

}

async function state(controller, config) {
    const victims = await controller.getBlockedUsers()
    const is_active = victims.length !== 0
    console.log(is_active ? "ON" : "OFF")
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
