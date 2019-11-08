const d3 = require('d3')
const d3tip = require('d3-tip')
const Chance = require('chance')
const _ = require('lodash/core')
const $ = require('jquery')
require('jquery-ui/ui/widgets/autocomplete')

const RingCalculator = require('../util/ringCalculator')
const QueryParams = require('../util/queryParamProcessor')

const MIN_BLIP_WIDTH = 12

const Radar = function (size, radar) {
  let svg
  let currentBlipsPage
  let searchBlipsPage
  let searchBlipsHistory
  let searchBlipsList
  let quadrantButtons
  let buttonsGroup
  let header
  let main
  let nav
  let pageNav
  let quadrantByName = {}
  let quadrantByOrder = {}
  let intro
  let alternativeDiv
  let sortedBlips

  const tip = d3tip().attr('class', 'd3-tip').html(function (text) {
    return text
  })

  tip.direction(function () {
    if (d3.select('.quadrant-table.selected').node()) {
      var selectedQuadrant = d3.select('.quadrant-table.selected')
      if (selectedQuadrant.classed('first') || selectedQuadrant.classed('fourth')) { return 'ne' } else { return 'nw' }
    }
    return 'n'
  })

  sortedBlips = radar.getBlips()
    .sort((a, b) => {
      return a.name().toLowerCase() < b.name().toLowerCase()
        ? -1
        : a.name().toLowerCase() > b.name().toLowerCase()
          ? 1
          : 0
    })
    .map((blip, i) => {
      blip.setOrder(i)
      return blip
    })

  var ringCalculator = new RingCalculator(radar.rings().length, center())

  var self = {}
  var chance

  function center () {
    return Math.round(size / 2)
  }

  function toRadian (angleInDegrees) {
    return Math.PI * angleInDegrees / 180
  }

  function plotLines (quadrantGroup, quadrant) {
    var startX = size * (1 - (-Math.sin(toRadian(quadrant.startAngle)) + 1) / 2)
    var endX = size * (1 - (-Math.sin(toRadian(quadrant.startAngle - 90)) + 1) / 2)

    var startY = size * (1 - (Math.cos(toRadian(quadrant.startAngle)) + 1) / 2)
    var endY = size * (1 - (Math.cos(toRadian(quadrant.startAngle - 90)) + 1) / 2)

    if (startY > endY) {
      var aux = endY
      endY = startY
      startY = aux
    }

    quadrantGroup.append('line')
      .attr('x1', center()).attr('x2', center())
      .attr('y1', startY - 2).attr('y2', endY + 2)
      .attr('stroke-width', 10)

    quadrantGroup.append('line')
      .attr('x1', endX).attr('y1', center())
      .attr('x2', startX).attr('y2', center())
      .attr('stroke-width', 10)
  }

  function plotQuadrant (rings, quadrant) {
    var quadrantGroup = svg.append('g')
      .attr('class', 'quadrant-group quadrant-group-' + quadrant.order)
      .on('mouseover', mouseoverQuadrant.bind({}, quadrant.order))
      .on('mouseout', mouseoutQuadrant.bind({}, quadrant.order))
      .on('click', () => setHash(`current/${quadrant.order}/${quadrant.startAngle}`))

    rings.forEach(function (ring, i) {
      var arc = d3.arc()
        .innerRadius(ringCalculator.getRadius(i))
        .outerRadius(ringCalculator.getRadius(i + 1))
        .startAngle(toRadian(quadrant.startAngle))
        .endAngle(toRadian(quadrant.startAngle - 90))

      quadrantGroup.append('path')
        .attr('d', arc)
        .attr('class', 'ring-arc-' + ring.order())
        .attr('transform', 'translate(' + center() + ', ' + center() + ')')
    })

    return quadrantGroup
  }

  function plotTexts (quadrantGroup, rings, quadrant) {
    rings.forEach(function (ring, i) {
      if (quadrant.order === 'first' || quadrant.order === 'fourth') {
        quadrantGroup.append('text')
          .attr('class', 'line-text')
          .attr('y', center() + 4)
          .attr('x', center() + (ringCalculator.getRadius(i) + ringCalculator.getRadius(i + 1)) / 2)
          .attr('text-anchor', 'middle')
          .text(ring.name())
      } else {
        quadrantGroup.append('text')
          .attr('class', 'line-text')
          .attr('y', center() + 4)
          .attr('x', center() - (ringCalculator.getRadius(i) + ringCalculator.getRadius(i + 1)) / 2)
          .attr('text-anchor', 'middle')
          .text(ring.name())
      }
    })
  }

  function triangle (blip, x, y, order, group) {
    return group.append('path').attr('d', 'M412.201,311.406c0.021,0,0.042,0,0.063,0c0.067,0,0.135,0,0.201,0c4.052,0,6.106-0.051,8.168-0.102c2.053-0.051,4.115-0.102,8.176-0.102h0.103c6.976-0.183,10.227-5.306,6.306-11.53c-3.988-6.121-4.97-5.407-8.598-11.224c-1.631-3.008-3.872-4.577-6.179-4.577c-2.276,0-4.613,1.528-6.48,4.699c-3.578,6.077-3.26,6.014-7.306,11.723C402.598,306.067,405.426,311.406,412.201,311.406')
      .attr('transform', 'scale(' + (blip.width / 34) + ') translate(' + (-404 + x * (34 / blip.width) - 17) + ', ' + (-282 + y * (34 / blip.width) - 17) + ')')
      .attr('class', order)
  }

  function triangleLegend (x, y, group) {
    return group.append('path').attr('d', 'M412.201,311.406c0.021,0,0.042,0,0.063,0c0.067,0,0.135,0,0.201,0c4.052,0,6.106-0.051,8.168-0.102c2.053-0.051,4.115-0.102,8.176-0.102h0.103c6.976-0.183,10.227-5.306,6.306-11.53c-3.988-6.121-4.97-5.407-8.598-11.224c-1.631-3.008-3.872-4.577-6.179-4.577c-2.276,0-4.613,1.528-6.48,4.699c-3.578,6.077-3.26,6.014-7.306,11.723C402.598,306.067,405.426,311.406,412.201,311.406')
      .attr('transform', 'scale(' + (22 / 64) + ') translate(' + (-404 + x * (64 / 22) - 17) + ', ' + (-282 + y * (64 / 22) - 17) + ')')
  }

  function circle (blip, x, y, order, group) {
    return (group || svg).append('path')
      .attr('d', 'M420.084,282.092c-1.073,0-2.16,0.103-3.243,0.313c-6.912,1.345-13.188,8.587-11.423,16.874c1.732,8.141,8.632,13.711,17.806,13.711c0.025,0,0.052,0,0.074-0.003c0.551-0.025,1.395-0.011,2.225-0.109c4.404-0.534,8.148-2.218,10.069-6.487c1.747-3.886,2.114-7.993,0.913-12.118C434.379,286.944,427.494,282.092,420.084,282.092')
      .attr('transform', 'scale(' + (blip.width / 34) + ') translate(' + (-404 + x * (34 / blip.width) - 17) + ', ' + (-282 + y * (34 / blip.width) - 17) + ')')
      .attr('class', order)
  }

  function circleLegend (x, y, group) {
    return (group || svg).append('path')
      .attr('d', 'M420.084,282.092c-1.073,0-2.16,0.103-3.243,0.313c-6.912,1.345-13.188,8.587-11.423,16.874c1.732,8.141,8.632,13.711,17.806,13.711c0.025,0,0.052,0,0.074-0.003c0.551-0.025,1.395-0.011,2.225-0.109c4.404-0.534,8.148-2.218,10.069-6.487c1.747-3.886,2.114-7.993,0.913-12.118C434.379,286.944,427.494,282.092,420.084,282.092')
      .attr('transform', 'scale(' + (22 / 64) + ') translate(' + (-404 + x * (64 / 22) - 17) + ', ' + (-282 + y * (64 / 22) - 17) + ')')
  }

  function addRing (ring, order) {
    var table = d3.select('.quadrant-table.' + order)
    table.append('h3').text(ring)
    return table.append('ul')
  }

  function calculateBlipCoordinates (blip, chance, minRadius, maxRadius, startAngle) {
    var adjustX = Math.sin(toRadian(startAngle)) - Math.cos(toRadian(startAngle))
    var adjustY = -Math.cos(toRadian(startAngle)) - Math.sin(toRadian(startAngle))

    var radius = chance.floating({ min: minRadius + blip.width / 2, max: maxRadius - blip.width / 2 })
    var angleDelta = Math.asin(blip.width / 2 / radius) * 180 / Math.PI
    angleDelta = angleDelta > 45 ? 45 : angleDelta
    var angle = toRadian(chance.integer({ min: angleDelta, max: 90 - angleDelta }))

    var x = center() + radius * Math.cos(angle) * adjustX
    var y = center() + radius * Math.sin(angle) * adjustY

    return [x, y]
  }

  function thereIsCollision (blip, coordinates, allCoordinates) {
    return allCoordinates.some(function (currentCoordinates) {
      return (Math.abs(currentCoordinates[0] - coordinates[0]) < blip.width) && (Math.abs(currentCoordinates[1] - coordinates[1]) < blip.width)
    })
  }

  function plotBlips (quadrantGroup, rings, quadrantWrapper) {
    var blips, quadrant, startAngle, order

    quadrant = quadrantWrapper.quadrant
    startAngle = quadrantWrapper.startAngle
    order = quadrantWrapper.order

    d3.select('.quadrant-table.' + order)
      .append('h2')
      .attr('class', 'quadrant-table__name')
      .text(quadrant.name())

    blips = quadrant.blips()
    rings.forEach(function (ring, i) {
      var ringBlips = blips.filter(function (blip) {
        return blip.ring() === ring
      })

      if (ringBlips.length === 0) {
        return
      }

      var maxRadius, minRadius

      minRadius = ringCalculator.getRadius(i)
      maxRadius = ringCalculator.getRadius(i + 1)

      var sumRing = ring.name().split('').reduce(function (p, c) {
        return p + c.charCodeAt(0)
      }, 0)
      var sumQuadrant = quadrant.name().split('').reduce(function (p, c) {
        return p + c.charCodeAt(0)
      }, 0)
      chance = new Chance(Math.PI * sumRing * ring.name().length * sumQuadrant * quadrant.name().length)

      var ringList = addRing(ring.name(), order)
      var allBlipCoordinatesInRing = []

      ringBlips.forEach(function (blip) {
        const coordinates = findBlipCoordinates(blip,
          minRadius,
          maxRadius,
          startAngle,
          allBlipCoordinatesInRing)

        allBlipCoordinatesInRing.push(coordinates)
        drawBlipInCoordinates(blip, coordinates, order, quadrantGroup, ringList)
      })
    })
  }

  function findBlipCoordinates (blip, minRadius, maxRadius, startAngle, allBlipCoordinatesInRing) {
    const maxIterations = 200
    var coordinates = calculateBlipCoordinates(blip, chance, minRadius, maxRadius, startAngle)
    var iterationCounter = 0
    var foundAPlace = false

    while (iterationCounter < maxIterations) {
      if (thereIsCollision(blip, coordinates, allBlipCoordinatesInRing)) {
        coordinates = calculateBlipCoordinates(blip, chance, minRadius, maxRadius, startAngle)
      } else {
        foundAPlace = true
        break
      }
      iterationCounter++
    }

    if (!foundAPlace && blip.width > MIN_BLIP_WIDTH) {
      blip.width = blip.width - 1
      return findBlipCoordinates(blip, minRadius, maxRadius, startAngle, allBlipCoordinatesInRing)
    } else {
      return coordinates
    }
  }

  function drawBlipInCoordinates (blip, coordinates, order, quadrantGroup, ringList) {
    var x = coordinates[0]
    var y = coordinates[1]

    var group = quadrantGroup.append('g').attr('class', 'blip-link').attr('id', 'blip-link-' + blip.number())
      .on('click', clickBlip)

    if (blip.isNew()) {
      triangle(blip, x, y, order, group)
    } else {
      circle(blip, x, y, order, group)
    }

    group.append('text')
      .attr('x', x)
      .attr('y', y + 4)
      .attr('class', 'blip-text')
      // derive font-size from current blip width
      .style('font-size', ((blip.width * 10) / 22) + 'px')
      .attr('text-anchor', 'middle')
      .text(blip.number())

    var blipListItem = ringList.append('li')
    var blipText = blip.number() + '. ' + blip.name() + (blip.topic() ? ('. - ' + blip.topic()) : '')
    blipListItem.append('div')
      .attr('class', 'blip-list-item')
      .attr('id', 'blip-list-item-' + blip.number())
      .text(blipText)

    var blipItemDescription = blipListItem.append('div')
      .attr('id', 'blip-description-' + blip.number())
      .attr('class', 'blip-item-description')

    if (blip.description()) {
      blipItemDescription.append('p').html(blip.description())
    }

    var blipItemDescriptionWrapper = blipItemDescription.append('div')
      .attr('class', 'blip-description-nav')
    blipItemDescriptionWrapper.append('button')
      .attr('class', 'blip-list-item-history')
      .on('click', () => showPage(`history/${blip.tag()}`))
      .text('History')

    var mouseOver = function () {
      d3.selectAll('g.blip-link').attr('opacity', 0.3)
      group.attr('opacity', 1.0)
      blipListItem.selectAll('.blip-list-item').classed('highlight', true)
      tip.show(blip.name(), group.node())
    }

    var mouseOut = function () {
      d3.selectAll('g.blip-link').attr('opacity', 1.0)
      blipListItem.selectAll('.blip-list-item').classed('highlight', false)
      tip.hide().style('left', 0).style('top', 0)
    }

    blipListItem.on('mouseover', mouseOver).on('mouseout', mouseOut)
    group.on('mouseover', mouseOver).on('mouseout', mouseOut)

    var clickBlip = function () {
      d3.select('.blip-item-description.expanded').node() !== blipItemDescription.node() &&
        d3.select('.blip-item-description.expanded').classed('expanded', false)
      blipItemDescription.classed('expanded', !blipItemDescription.classed('expanded'))

      blipItemDescription.on('click', function () {
        d3.event.stopPropagation()
      })
    }

    blipListItem.on('click', clickBlip)
  }

  function removeRadarLegend () {
    d3.select('.legend').remove()
  }

  function drawLegend (order) {
    removeRadarLegend()

    var triangleKey = 'New or moved'
    var circleKey = 'No change'

    var container = d3.select('svg').append('g')
      .attr('class', 'legend legend' + '-' + order)

    var x = 10
    var y = 10

    if (order === 'first') {
      x = 1 * size / 5 - 15
      y = 1 * size / 5 - 20
    }

    if (order === 'second') {
      x = 4 * size / 5 - 20
      y = 1 * size / 5
    }

    if (order === 'third') {
      x = 1 * size / 5 - 15
      y = 4 * size / 5 + 15
    }

    if (order === 'fourth') {
      x = 4 * size / 5 - 20
      y = 4 * size / 5
    }

    d3.select('.legend')
      .attr('class', 'legend legend-' + order)
      .style('visibility', 'visible')

    triangleLegend(x, y, container)

    container
      .append('text')
      .attr('x', x + 15)
      .attr('y', y + 5)
      .attr('font-size', '0.8em')
      .text(triangleKey)

    circleLegend(x, y + 20, container)

    container
      .append('text')
      .attr('x', x + 15)
      .attr('y', y + 25)
      .attr('font-size', '0.8em')
      .text(circleKey)
  }

  function setHash (path) {
    window.location.hash = `/${path}`
  }

  function showPage (path) {
    const [page, ...sections] = path.split('/')
    console.log('draw page', page, path, sections)
    currentBlipsPage.style('display', () => {
      return (page === 'current') ? 'flex' : 'none'
    })
    searchBlipsPage.style('display', () => {
      return (page === 'search') ? 'flex' : 'none'
    })
    searchBlipsHistory.style('display', () => {
      return (page === 'history') ? 'flex' : 'none'
    })

    switch (page) {
      case 'current':
        redrawFullRadar()
        if (sections && sections.length >= 1 && ['first', 'second', 'third', 'fourth'].includes(sections[0])) {
          const selectedQuadrant = quadrantByOrder[sections[0]]
          selectQuadrant(selectedQuadrant.order, selectedQuadrant.startAngle)
        }
        break
      case 'search':
        redrawFullSearch()
        break
      case 'history':
        redrawFullHistory()
        if (sections && sections.length) {
          const found = sortedBlips.find((blip) => blip.tag() === sections[0])
          if (found) {
            plotBlipHistory(found)
          }
        } else {
          showPage('search')
        }
        break
      default:
        showPage('current')
    }
  }

  function redrawFullRadar () {
    removeRadarLegend()
    tip.hide()
    d3.selectAll('g.blip-link').attr('opacity', 1.0)

    d3.selectAll('.button')
      .classed('selected', false)
      .classed('full-view', true)

    d3.selectAll('.quadrant-table').classed('selected', false)
    d3.selectAll('.home-link').classed('selected', false)

    d3.selectAll('.quadrant-group')
      .attr('transform', 'scale(1)')

    d3.selectAll('.quadrant-group .blip-link')
      .attr('transform', 'scale(1)')

    d3.selectAll('.quadrant-group')
      .style('pointer-events', 'auto')

    intro.classed('selected', true)
  }

  function redrawFullSearch () {
    d3.selectAll('.button')
      .classed('selected', false)
      .classed('full-view', true)
  }

  function redrawFullHistory () {
    d3.selectAll('.button')
      .classed('selected', false)
      .classed('full-view', true)
  }

  function searchBlip (_e, ui) {
    const { blip, quadrant } = ui.item
    const isQuadrantSelected = d3.select('div.button.' + quadrant.order).classed('selected')
    // selectQuadrant.bind({}, quadrant.order, quadrant.startAngle)()
    setHash(`current/${quadrant.order}`)
    const selectedDesc = d3.select('#blip-description-' + blip.number())
    d3.select('.blip-item-description.expanded').node() !== selectedDesc.node() &&
        d3.select('.blip-item-description.expanded').classed('expanded', false)
    selectedDesc.classed('expanded', true)

    d3.selectAll('g.blip-link').attr('opacity', 0.3)
    const group = d3.select('#blip-link-' + blip.number())
    group.attr('opacity', 1.0)
    d3.selectAll('.blip-list-item').classed('highlight', false)
    d3.select('#blip-list-item-' + blip.number()).classed('highlight', true)
    if (isQuadrantSelected) {
      tip.show(blip.name(), group.node())
    } else {
      // need to account for the animation time associated with selecting a quadrant
      tip.hide()

      tip.show(blip.name(), group.node())
    }
  }

  function plotRadarHeader () {
    header = d3.select('header')
    header.selectAll('.input-sheet__logo').remove()

    const title = header.insert('div', '.profile')
      .attr('class', 'radar-title')

    title.append('div')
      .attr('class', 'radar-title__text')
      .append('h2')
      .text(document.title)
      .style('cursor', 'pointer')
      .on('click', () => setHash('current'))

    return header
  }

  function plotRadarNav () {
    nav = d3.select('nav')

    nav.append('h1')
      .text('TECHNOLOGY RADAR')
      .on('click', () => setHash('current'))

    pageNav = nav.append('div')
      .classed('page-btn-group', true)
      .append('button')
      .classed('button', true)
      .classed('search', true)
      .attr('title', 'Browse Radar archives')
      .text('Search')
      .on('click', () => setHash('search'))

    buttonsGroup = nav.append('div')
      .classed('buttons-group', true)

    quadrantButtons = buttonsGroup.append('div')
      .classed('quadrant-btn--group', true)

    alternativeDiv = nav.append('div')
      .attr('id', 'alternative-buttons')

    return nav
  }

  function plotRadarMain () {
    main = d3.select('main')
      .attr('id', 'radar')

    intro = currentBlipsPage
      .append('div')
      .attr('id', 'radar-intro')
      .classed('selected', true)

    intro.append('div')
      .text('Welcome')

    return main
  }

  function plotQuadrantButtons (quadrants) {
    function addButton (quadrant) {
      currentBlipsPage
        .append('div')
        .attr('class', 'quadrant-table ' + quadrant.order)

      quadrantButtons.append('div')
        .attr('class', 'button ' + quadrant.order + ' full-view')
        .text(quadrant.quadrant.name())
        .on('mouseover', mouseoverQuadrant.bind({}, quadrant.order))
        .on('mouseout', mouseoutQuadrant.bind({}, quadrant.order))
        .on('click', () => setHash(`current/${quadrant.order}`))
    }

    _.each([0, 1, 2, 3], function (i) {
      addButton(quadrants[i])
    })

    $('#auto-complete').autocomplete({
      source: _.flatten(_.map(quadrants, function (q, i) {
        return _.map(q.quadrant.blips(), function (b) {
          const name = b.name()
          return { label: name, value: name, blip: b, quadrant: q }
        })
      })),
      select: searchBlip.bind({})
    })
  }

  function plotSearch () {
    // searchBlipsFilter = searchBlipsPage.append('div')
    //   .attr('class', 'filter')

    // searchBlipsFilter.append('div')
    //   .classed('search-box', true)
    //   .append('input')
    //   .attr('id', 'auto-complete')
    //   .attr('placeholder', 'Search')
    //   .classed('search-radar', true)

    searchBlipsList = searchBlipsPage.append('ul')
      .attr('class', 'blips')

    const alphabetKeys = []

    sortedBlips.forEach((blip, i) => {
      let section
      const currentQuadrant = quadrantByName[blip.quadrant()]

      section = blip.name()[0].toUpperCase() >= 'A' ? blip.name()[0].toUpperCase() : 'Special characters & Numerics'

      if (!alphabetKeys.includes(section)) {
        searchBlipsList.append('h3')
          .attr('class', 'alphabet-key')
          .text(section)

        alphabetKeys.push(section)
      }

      let node = searchBlipsList.append('li')
        .attr('class', 'blip ')
        .attr('data-state', blip.state())

      node.append('h4')
        .attr('class', 'blip-history')
        .text(blip.name())
        .on('click', () => setHash(`history/${blip.tag()}`))

      node.append('span')
        .attr('class', `blip-ring blip-ring-${blip.ring().name()} quadrant-${currentQuadrant.tag()} ${currentQuadrant.order}`)
        .text(blip.ring().name())

      node.append('span')
        .attr('class', 'blip-date')
        .text(blip.date())
      console.log('blip', blip.name(), blip.history())
    })
  }

  function plotHistory () {
    searchBlipsHistory = d3.select('#history')
  }

  function plotBlipHistory (blip) {
    const i = blip.order()

    searchBlipsHistory.selectAll('.blip-history').classed('selected', false)

    let isBlipCurrent = true
    let selected = searchBlipsHistory.select(`#blip-${i}`).classed('selected', true)

    if (!selected.empty()) return

    selected = searchBlipsHistory.append('div')
      .attr('id', `blip-${i}`)
      .classed('blip-history', true)
      .classed('selected', true)
      .attr('data-blip-state', blip.state())

    if (blip.state().toLowerCase() === 'archived') {
      selected.append('div')
        .classed('blip-archived', true)
        .text(`
          This blip is archived and not on the current radar, if its latest update 
          was within six months, it is likely to be considered as the same status 
        `)
    }

    selected.append('h2').text(blip.name())

    const list = selected.append('ul')

    blip.history().forEach((history) => {
      const current = list.append('li')
      const state = history.state().toLowerCase()
      isBlipCurrent = state === 'archived' ? false : isBlipCurrent

      const meta = current.append('span').classed('meta', true).classed('history-latest', isBlipCurrent)

      meta.append('span')
        .attr('class', `history-date history-date-${history.date()} history-state-${state}`)
        .text(history.date())

      meta.append('h3')
        .attr('class', `history-ring history-ring-${history.ring().name()}`)
        .text(history.ring().name())

      current.append('div')
        .attr('class', 'history-description history-description')
        .text(history.description())
    })
  }

  function mouseoverQuadrant (order) {
    d3.select('.quadrant-group-' + order).style('opacity', 1)
    d3.selectAll('.quadrant-group:not(.quadrant-group-' + order + ')').style('opacity', 0.3)
  }

  function mouseoutQuadrant (order) {
    d3.selectAll('.quadrant-group:not(.quadrant-group-' + order + ')').style('opacity', 1)
  }

  function selectQuadrant (order, startAngle) {
    intro.classed('selected', false)
    d3.selectAll('.home-link').classed('selected', false)
    d3.selectAll('.button').classed('selected', false).classed('full-view', false)
    d3.selectAll('.button.' + order).classed('selected', true)
    d3.selectAll('.quadrant-table').classed('selected', false)
    d3.selectAll('.quadrant-table.' + order).classed('selected', true)
    d3.selectAll('.blip-item-description').classed('expanded', false)

    var scale = 2

    var adjustX = Math.sin(toRadian(startAngle)) - Math.cos(toRadian(startAngle))
    var adjustY = Math.cos(toRadian(startAngle)) + Math.sin(toRadian(startAngle))

    var translateX = (-1 * (1 + adjustX) * size / 2 * (scale - 1)) + (-adjustX * (1 - scale / 2) * size)
    var translateY = (-1 * (1 - adjustY) * (size / 2 - 7) * (scale - 1)) - ((1 - adjustY) / 2 * (1 - scale / 2) * size)

    var translateXAll = (1 - adjustX) / 2 * size * scale / 2 + ((1 - adjustX) / 2 * (1 - scale / 2) * size)
    var translateYAll = (1 + adjustY) / 2 * size * scale / 2

    var blipScale = 3 / 4
    var blipTranslate = (1 - blipScale) / blipScale

    d3.select('.quadrant-group-' + order)
      .attr('transform', 'translate(' + translateX + ',' + translateY + ')scale(' + scale + ')')
    d3.selectAll('.quadrant-group-' + order + ' .blip-link text').each(function () {
      var x = d3.select(this).attr('x')
      var y = d3.select(this).attr('y')
      d3.select(this.parentNode)
        .attr('transform', 'scale(' + blipScale + ')translate(' + blipTranslate * x + ',' + blipTranslate * y + ')')
    })

    d3.selectAll('.quadrant-group')
      .style('pointer-events', 'auto')

    d3.selectAll('.quadrant-group:not(.quadrant-group-' + order + ')')
      .style('pointer-events', 'none')
      .attr('transform', 'translate(' + translateXAll + ',' + translateYAll + ')scale(0)')

    if (d3.select('.legend.legend-' + order).empty()) {
      drawLegend(order)
    }
  }

  self.init = function () {
    currentBlipsPage = d3.select('main')
      .attr('id', 'radar')
      .append('div')
      .attr('id', 'current')

    searchBlipsPage = d3.select('#radar')
      .append('div')
      .attr('id', 'search')

    searchBlipsHistory = d3.select('#radar')
      .append('div')
      .attr('id', 'history')

    return self
  }

  function constructSheetUrl (sheetName) {
    var noParamUrl = window.location.href.substring(0, window.location.href.indexOf(window.location.search))
    var queryParams = QueryParams(window.location.search.substring(1))
    var sheetUrl = noParamUrl + '?sheetId=' + queryParams.sheetId + '&sheetName=' + encodeURIComponent(sheetName)
    return sheetUrl
  }

  function plotAlternativeRadars (alternatives, currentSheet) {
    var alternativeSheetButton = alternativeDiv
      .append('div')
      .classed('multiple-sheet-button-group', true)

    // alternativeSheetButton.append('p').text('Choose a sheet to populate radar')
    alternatives.forEach(function (alternative) {
      alternativeSheetButton
        .append('div:a')
        .attr('class', 'first full-view alternative multiple-sheet-button')
        .attr('href', constructSheetUrl(alternative))
        .text(alternative)

      if (alternative === currentSheet) {
        d3.selectAll('.alternative').filter(function () {
          return d3.select(this).text() === alternative
        }).attr('class', 'highlight multiple-sheet-button')
      }
    })
  }

  function processHash () {
    const [, ...path] = window.location.hash.split('/')
    showPage(path.join('/'))
  }

  self.plot = function () {
    var rings, quadrants, alternatives, currentSheet

    rings = radar.rings()
    quadrants = radar.quadrants()
    alternatives = radar.getAlternatives()
    currentSheet = radar.getCurrentSheet()
    header = plotRadarHeader()
    nav = plotRadarNav()
    main = plotRadarMain()

    plotAlternativeRadars(alternatives, currentSheet)

    plotQuadrantButtons(quadrants)

    svg = currentBlipsPage.append('svg').call(tip)
    svg.attr('id', 'radar-plot').attr('width', size).attr('height', size + 14)

    _.each(quadrants, function (quadrant) {
      const quadrantWithOrder = { ...quadrant.quadrant, order: quadrant.order, startAngle: quadrant.startAngle }
      quadrantByName[quadrant.quadrant.name()] = quadrantWithOrder
      quadrantByOrder[quadrant.order] = quadrantWithOrder

      var quadrantGroup = plotQuadrant(rings, quadrant)
      plotLines(quadrantGroup, quadrant)
      plotTexts(quadrantGroup, rings, quadrant)
      plotBlips(quadrantGroup, rings, quadrant)
    })

    plotSearch()
    plotHistory()

    window.onhashchange = processHash
    processHash()
  }

  return self
}

module.exports = Radar

/**
 * Pure svg markup radar 500 x 500
 * ```xml
<svg width="500" height="500" viewBox="0 0 500 500">
    <circle cx="250" cy="250" r="250" fill="#eee" mask="url(#quadrant-mask)"></circle>
    <circle cx="250" cy="250" r="219" fill="#dadada" mask="url(#quadrant-mask)"></circle>
    <circle cx="250" cy="250" r="172" fill="#cacaca" mask="url(#quadrant-mask)"></circle>
    <circle cx="250" cy="250" r="110" fill="#bababa" mask="url(#quadrant-mask)"></circle>
    <mask id="quadrant-mask">
        <rect x="0" y="0" width="245" height="245" fill="white"></rect>
        <rect x="0" y="255" width="245" height="245" fill="white"></rect>
        <rect x="255" y="0" width="245" height="245" fill="white"></rect>
        <rect x="255" y="255" width="245" height="245" fill="white"></rect>
    </mask>
    <text class="line-text" y="254" x="15.625" text-anchor="middle">hold</text>
    <text class="line-text" y="254" x="54.6875" text-anchor="middle">assess</text>
    <text class="line-text" y="254" x="110.1875" text-anchor="middle">trial</text>
    <text class="line-text" y="254" x="196.125" text-anchor="middle">adopt</text>
    <text class="line-text" y="254" x="303.875" text-anchor="middle">adopt</text>
    <text class="line-text" y="254" x="389.8125" text-anchor="middle">trial</text>
    <text class="line-text" y="254" x="445.3125" text-anchor="middle">assess</text>
    <text class="line-text" y="254" x="484.375" text-anchor="middle">hold</text>
    <g transform="translate(20,2.5)">
      <polygon points="265,260 260,270 270,270" translate="" class="triangle" style="stroke: green; stroke-width: 10; stroke-linejoin: round;" stroke="green"></polygon>
    </g>
    <polygon points="0,-4 -3.5,4 3.5,4" transform="translate(230,265)" class="triangle" style="stroke: green; stroke-width: 10; stroke-linejoin: round;" stroke="green"></polygon>
    <polygon points="0,-12 -10.5,6 10.5,6" transform="translate(230,265)" class="triangle" style="stroke: green; fill: green; stroke-width: 5; stroke-linejoin: round;" stroke="green"></polygon>
    <polygon points="0,-10 -8.75,5 8.75,5" transform="translate(230,265)" class="triangle" style="stroke: green; fill: green; stroke-width: 5; stroke-linejoin: round;" stroke="green"></polygon>
</svg>
<svg width="500" height="500" viewBox="0 0 500 500">
    <circle cx="250" cy="250" r="250" fill="#eee" mask="url(#quadrant-mask)"></circle>
    <circle cx="250" cy="250" r="219" fill="#dadada" mask="url(#quadrant-mask)"></circle>
    <circle cx="250" cy="250" r="172" fill="#cacaca" mask="url(#quadrant-mask)"></circle>
    <circle cx="250" cy="250" r="110" fill="#bababa" mask="url(#quadrant-mask)"></circle>
    <mask id="quadrant-mask">
        <rect x="0" y="0" width="245" height="245" fill="white"></rect>
        <rect x="0" y="255" width="245" height="245" fill="white"></rect>
        <rect x="255" y="0" width="245" height="245" fill="white"></rect>
        <rect x="255" y="255" width="245" height="245" fill="white"></rect>
    </mask>
    <text class="line-text" y="254" x="15.625" text-anchor="middle">hold</text>
    <text class="line-text" y="254" x="54.6875" text-anchor="middle">assess</text>
    <text class="line-text" y="254" x="110.1875" text-anchor="middle">trial</text>
    <text class="line-text" y="254" x="196.125" text-anchor="middle">adopt</text>
    <text class="line-text" y="254" x="303.875" text-anchor="middle">adopt</text>
    <text class="line-text" y="254" x="389.8125" text-anchor="middle">trial</text>
    <text class="line-text" y="254" x="445.3125" text-anchor="middle">assess</text>
    <text class="line-text" y="254" x="484.375" text-anchor="middle">hold</text>
</svg>

```
*/
