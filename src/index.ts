import * as fs from 'fs'
import * as commander from 'commander'

import * as UBNTClient from './ubntClient'

type State = 'blocked' | 'unblocked'

const COMMANDS = [ 'block', 'unblock' ]

interface Configuration {
    url: string,
    site: string,
    login: string,
    password: string,
    macs: string[]
}

function die(message: string, code: number = 1) : never {
    console.log(message)
    process.exit(code)
}

function get_configuration(filename: string) : Configuration {
    if (!fs.existsSync(filename)){
        die(`${filename} does not exist`)
    }
    const config = fs.readFileSync(filename)
    return JSON.parse(config.toString())
}

function get_args() : any {
    return commander
        .version('0.0.1')
        .arguments('<cmd>')
        .option("-c, --config <path>", "Configuration file", "config.json")
        .parse(process.argv)
}

async function ensure_state(client: any, desired: State, mac: string) : Promise<boolean> {
    const actual : State = await client.isBlocked(mac) ? 'blocked' : 'unblocked'
    if (desired == actual){
        return true
    }

    switch (desired) {
        case 'blocked' : return await client.blockMac(mac)
        case 'unblocked' : return await client.unblockMac(mac)
    }
}

async function main() : Promise<void> {
    const args = get_args()
    // TODO: this sucks
    const cmd = 1 == args.args.length ? args.args[0] : 'help'
    if (!(COMMANDS.includes(cmd))) {
        die(`I need block or unblock`)
    }

    // TODO: this sucks
    const desired : State = cmd == 'block' ? 'blocked' : 'unblocked'

    const config = get_configuration(args.config)
    const client = new UBNTClient.UBNTClient(config.url, config.site, config.login, config.password)

    for (const mac of config.macs){
        const success = await ensure_state(client, desired, mac)
        console.log(success)
    }
}

main()
