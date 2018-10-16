const fs = require('fs')
const child_process = require('child_process')
const util = require('util')

const readFile = util.promisify(fs.readFile)
const exec = util.promisify(child_process.exec)

module.exports = async (config, data) => {
  const existing = await tryRead(config.privateKey)
  const privateKey = existing || await genKey()
  const publicKey = await pubKey(privateKey)
  Object.assign(data, { privateKey, publicKey })
}

async function tryRead(file) {
  try {
    return await readFile(file, 'utf8')
  } catch(err) {
    return ''
  }
}

async function genKey() {
  const { stdout } = await exec('wg genkey')
  return stdout.slice(0, -1)
}

async function pubKey(privateKey) {
  const { stdout } = await exec(`echo "${privateKey}" | wg pubkey`)
  return stdout.slice(0, -1)
}