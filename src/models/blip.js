const IDEAL_BLIP_WIDTH = 22
const Blip = function (blip, ring) {
  const history = []
  const self = {}
  let number = -1

  self.width = IDEAL_BLIP_WIDTH
  self.blip = blip
  // Add url slug for blip
  self.blip.tag = blip.name.replace(/\s/g, '-').replace(/&/g, 'and').replace(/'"\(\)/g, '').toLowerCase()

  self.name = function () {
    return self.blip.name
  }

  self.tag = function () {
    return self.blip.tag
  }

  self.topic = function () {
    return self.blip.topic || ''
  }

  self.description = function () {
    return self.blip.description || ''
  }

  self.isNew = function () {
    const newState = self.blip.state && self.blip.state.toLowerCase() === 'new'
    return newState || self.blip.isNew.toLowerCase() === 'true'
  }

  self.ring = function () {
    return ring
  }

  self.setOrder = function (i) {
    self.blip.order = i
  }

  self.order = function () {
    return self.blip.order
  }

  self.date = function () {
    return self.blip.date
  }

  self.quadrant = function () {
    return self.blip.quadrant
  }

  self.state = function () {
    return self.blip.state
  }

  self.number = function () {
    return number
  }

  self.setNumber = function (newNumber) {
    number = newNumber
  }

  self.addHistory = function (blip) {
    history.push(blip)
  }

  self.history = () => history.sort((a, b) => a.date() < b.date() ? 1 : a.date() > b.date() ? -1 : 0)

  return self
}

module.exports = Blip
