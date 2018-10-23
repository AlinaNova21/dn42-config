const dns = require('dns')
const util = require('util')

const lookup = util.promisify(dns.lookup)

module.exports = async (config, data) => {
  data.netsets = {
    ipv4: `[${data.nets.ipv4.join(',')}]`,
    ipv6: `[${data.nets.ipv6.join(',')}]`,
  }
  data.peers = data.peers
    .map(peer => {
      peer.type = peer.type || 'dnpeers'
      if (peer.wireguard) {
        peer.wireguard.listenPort = peer.wireguard.listenPort || parseInt(peer.as.slice(-5))
        peer.wireguard.interface = `wg-peer-${peer.name}`.slice(0,15)
      }
      return peer
    })
    .filter(p => p.enabled)
  data.ibgp = data.ibgp
    .map(peer => {
      peer.as = data.as
      peer.type = peer.type || 'iBGP_Peer'
      peer.multiChannel = 'ipv4'
      if (peer.wireguard) {
        peer.wireguard.listenPort = peer.wireguard.listenPort || parseInt(peer.as.slice(-5))
        peer.wireguard.interface = `wg-int-${peer.name}`.slice(0,15)
      }
      return peer
    })
    .filter(p => p.enabled)
  data.allPeers = [...data.ibgp, ...data.peers]
  for (const p of data.allPeers) {
		if(p.wireguard && p.wireguard.endpoint) {
			const [host,port] = p.wireguard.endpoint.split(':')
			const { address } = await lookup(host, { verbatim: true })
			p.wireguard.endpoint = `${address || host}:${port}`
		}
  }
  data.wgConfig = JSON.stringify({
    ipv4: data.ipv4,
    ipv6: data.ipv6,
    localipv6: data.localipv6,
    peers: data.allPeers
      .filter(p => p.wireguard)
      .map(p => {
        const wg = p.wireguard
        wg.ipv4 = p.ipv4
        wg.ipv6 = p.ipv6
        return wg 
      })
  })
}