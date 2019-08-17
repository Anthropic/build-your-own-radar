const MalformedDataError = require('../exceptions/malformedDataError')
const ExceptionMessages = require('../util/exceptionMessages')

const _ = {
  map: require('lodash/map'),
  uniqBy: require('lodash/uniqBy'),
  sortBy: require('lodash/sortBy')
}

const Radar = function (ringLabels) {
  var self, quadrants, blipNumber, addingQuadrant, alternatives, currentSheetName, allBlips

  blipNumber = 0
  addingQuadrant = 0
  quadrants = [
    { order: 'first', startAngle: 0 },
    { order: 'second', startAngle: 90 },
    { order: 'third', startAngle: -90 },
    { order: 'fourth', startAngle: -180 }
  ]
  alternatives = []
  currentSheetName = ''

  self = {}

  function setNumbers (blips) {
    blips.forEach(function (blip) {
      blip.setNumber(++blipNumber)
    })
  }

  self.addAlternative = function (sheetName) {
    alternatives.push(sheetName)
  }

  self.getAlternatives = function () {
    return alternatives
  }

  self.setBlips = function (blips) {
    allBlips = blips
  }

  self.getBlips = function () {
    return allBlips
  }

  self.setCurrentSheet = function (sheetName) {
    currentSheetName = sheetName
  }

  self.getCurrentSheet = function () {
    return currentSheetName
  }

  self.addQuadrant = function (quadrant) {
    if (addingQuadrant >= 4) {
      throw new MalformedDataError(ExceptionMessages.TOO_MANY_QUADRANTS)
    }
    quadrants[addingQuadrant].quadrant = quadrant
    setNumbers(quadrant.blips())
    addingQuadrant++
  }

  function allQuadrants () {
    if (addingQuadrant < 4) { throw new MalformedDataError(ExceptionMessages.LESS_THAN_FOUR_QUADRANTS) }

    return _.map(quadrants, 'quadrant')
  }

  function currentBlips () {
    return allQuadrants().reduce((blips, quadrant) => {
      return blips.concat(quadrant.blips())
    }, [])
  }

  self.rings = function () {
    // return RING_LABELS.map((label, i) => {
    //   return {
    //     name () {
    //       return label
    //     },
    //     order () {
    //       return i
    //     }
    //   }
    // })

    var rings = _.sortBy(
      _.map(
        _.uniqBy(
          currentBlips(),
          (blip) => {
            return blip.ring().name()
          }
        ),
        (blip) => {
          return blip.ring()
        }
      ),
      (ring) => {
        return ring.order()
      }
    )
    return rings
  }

  self.quadrants = function () {
    return quadrants
  }

  return self
}

module.exports = Radar
