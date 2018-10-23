const child_process = require('child_process')
const fs = require('fs')
const util = require('util')

const exec2 = util.promisify(child_process.exec)
const exec = (cmd) => {
  console.log(`exec: '${cmd}'`)
  return exec2(cmd)
}
const readFile = util.promisify(fs.readFile)

const PID = process.pid
const NS=`nsenter --net=/proc/1/ns/net --no-fork`

async function run() {
  setInterval(tick, 10000)
  await tick()
}

async function tick () {
  const config = await loadConfig()
  try { await exec(`ip addr add "${config.ipv4}/32" dev lo`) } catch(e) {}
  try { await exec(`ip addr add "${config.ipv6}/128" dev lo`) } catch(e) {}
  try { await exec(`ip addr add "${config.localipv6}/128" dev lo`) } catch(e) {}
  for(const peer of config.peers) {
    try {
      console.log(`Checking ${peer.interface}...`)
      if(!await hasInterface(peer.interface)) {
        await createInterface(peer.interface)
        await configureInterface(config, peer)
      }
    } catch(err) {
      console.log(`Error for interface ${peer.interface}: ${err}`)
      await removeInterface(peer.interface)
    }
  }
  console.log('Checks complete')
}

async function loadConfig() {
  return JSON.parse(await readFile('/etc/bird/wireguard/config.json', 'utf8'))
}

async function hasInterface(name) {
  try {
    const { stdout, stderr } = await exec(`ip link show dev "${name}"`)
    return true
  } catch (e) {
    return false
  }
}

async function configureInterface(config, peer) {
  let conf = `private-key /etc/bird/wireguard/private.key peer "${peer.publicKey}" allowed-ips "0.0.0.0/0, ::/0"`
  if (peer.endpoint) conf += ` endpoint "${peer.endpoint}"`
  if (peer.listenPort) conf = `listen-port ${peer.listenPort} ${conf}`
  await exec(`wg set "${peer.interface}" ${conf}`)
  await exec(`ip link set dev "${peer.interface}" up`)
  let v4addr = `ip addr add "${config.ipv4}" dev "${peer.interface}"`
  if (peer.ipv4) {
    v4addr += ` peer ${peer.ipv4}/32`
  }
  await exec(v4addr)
  await exec(`ip addr add "${config.localipv6}/64" dev "${peer.interface}"`)
  if (peer.ipv6) {
    await exec(`ip route add "${peer.ipv6}" dev "${peer.interface}"`)
  }
}

async function createInterface(name) {
  await removeInterface(name)
  console.log(`Creating ${name}`)
  await exec(`${NS} ip link add dev "${name}" type wireguard`)
  await exec(`${NS} ip link set dev "${name}" netns ${PID}`)
}

async function removeInterface(name) {
  if (await hasInterface(name)) {
    console.log(`Removing ${name}`)
    await exec(`ip link del "${name}"`)
  }
}

run().catch(console.error)