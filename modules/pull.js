const axios = require('axios')
const YAML = require('yamljs')

const cache = new Map()

module.exports = async (config, data) => {
  data.pullUrls = data.pullUrls || []
	for(const url of data.pullUrls) {
		if (!cache.has(url)) {
  		console.log(`Fetching config from ${url}`)
			const { data } = await axios.get(url)
			cache.set(url, data)
		}
		const raw = cache.get(url)
		Object.assign(data, YAML.parse(raw))
	}
	return data
}