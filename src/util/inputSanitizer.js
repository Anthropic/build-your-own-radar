const sanitizeHtml = require('sanitize-html')
const _ = {
  forOwn: require('lodash/forOwn')
}

const InputSanitizer = function () {
  var relaxedOptions = {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'ul',
      'br', 'p', 'u'],
    allowedAttributes: {
      'a': ['href']
    }
  }

  var restrictedOptions = {
    allowedTags: [],
    allowedAttributes: {},
    textFilter: function (text) {
      return text.replace(/&amp;/, '&')
    }
  }

  function trimWhiteSpaces (blip) {
    var processedBlip = {}
    _.forOwn(blip, function (value, key) {
      processedBlip[key.trim()] = value == null ? undefined : value.trim()
    })
    return processedBlip
  }

  var self = {}
  self.sanitize = function (rawBlip) {
    var blip = {}
    rawBlip = trimWhiteSpaces(rawBlip)

    blip.date = sanitizeHtml(rawBlip.date, restrictedOptions)
    blip.description = sanitizeHtml(rawBlip.description, relaxedOptions)
    blip.name = sanitizeHtml(rawBlip.name, restrictedOptions)
    blip.state = sanitizeHtml(rawBlip.state, restrictedOptions)
    blip.isNew = sanitizeHtml(rawBlip.isNew, restrictedOptions)
    blip.ring = sanitizeHtml(rawBlip.ring, restrictedOptions)
    blip.quadrant = sanitizeHtml(rawBlip.quadrant, restrictedOptions)

    return blip
  }

  self.sanitizeForProtectedSheet = function (rawBlip, header) {
    var blip = trimWhiteSpaces(rawBlip)

    const descriptionIndex = header.indexOf('description')
    const nameIndex = header.indexOf('name')
    const isNewIndex = header.indexOf('isNew')
    const quadrantIndex = header.indexOf('quadrant')
    const ringIndex = header.indexOf('ring')

    const description = descriptionIndex === -1 ? '' : blip[descriptionIndex]
    const name = nameIndex === -1 ? '' : blip[nameIndex]
    const isNew = isNewIndex === -1 ? '' : blip[isNewIndex]
    const ring = ringIndex === -1 ? '' : blip[ringIndex]
    const quadrant = quadrantIndex === -1 ? '' : blip[quadrantIndex]

    blip.description = sanitizeHtml(description, relaxedOptions)
    blip.name = sanitizeHtml(name, restrictedOptions)
    blip.isNew = sanitizeHtml(isNew, restrictedOptions)
    blip.ring = sanitizeHtml(ring, restrictedOptions)
    blip.quadrant = sanitizeHtml(quadrant, restrictedOptions)

    return blip
  }

  return self
}

module.exports = InputSanitizer
