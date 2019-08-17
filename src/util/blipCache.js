const BlipCache = function (blips) {
  function getBlips() {
    return blips
  }

  function getUniqueNames() {
    const names = blips.map((blip) => blip.name)
    return [...new Set(names)]
  }

  function getCurrent(testBlip) {
    return blips.filter((blip) => blip.name === testBlip.name && ["CURRENT", "NEW"].includes(blip.state))[0]
  }

  return {
    getBlips,
    getUniqueNames,
    getCurrent
  }
}
module.exports = BlipCache