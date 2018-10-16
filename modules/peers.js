module.exports = (config, data) => {
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
      if (peer.wireguard) {
        peer.wireguard.listenPort = peer.wireguard.listenPort || parseInt(peer.as.slice(-5))
        peer.wireguard.interface = `wg-int-${peer.name}`.slice(0,15)
      }
      return peer
    })
    .filter(p => p.enabled)
  data.allPeers = [...data.ibgp, ...data.peers]
}