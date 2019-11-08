const Quadrant = function (name) {
  var self, blips, tag

  self = {}
  blips = []
  tag = name.replace(/\s/g, '-').replace(/&/g, 'and').replace(/['"()]/g, '')

  self.name = function () {
    return name
  }

  self.tag = function () {
    return tag
  }

  self.add = function (newBlips) {
    if (Array.isArray(newBlips)) {
      blips = blips.concat(newBlips)
    } else {
      blips.push(newBlips)
    }
  }

  self.blips = function () {
    return blips.slice(0)
  }

  return self
}

module.exports = Quadrant
