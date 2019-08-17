/* eslint no-constant-condition: "off" */
const d3 = require('d3')
// const Tabletop = require('tabletop')
const _ = {
  map: require('lodash/map'),
  uniqBy: require('lodash/uniqBy'),
  capitalize: require('lodash/capitalize'),
  each: require('lodash/each')
}

const InputSanitizer = require('./inputSanitizer')
const BlipCache = require('./blipCache')
const Radar = require('../models/radar')
const Quadrant = require('../models/quadrant')
const Ring = require('../models/ring')
const Blip = require('../models/blip')
const GraphingRadar = require('../graphing/radar')
const QueryParams = require('./queryParamProcessor')
const MalformedDataError = require('../exceptions/malformedDataError')
const SheetNotFoundError = require('../exceptions/sheetNotFoundError')
const UnauthorizedError = require('../exceptions/unauthorizedError')
const ContentValidator = require('./contentValidator')
const Sheet = require('./sheet')
const ExceptionMessages = require('./exceptionMessages')
const GoogleAuth = require('./googleAuth')
const LoginForm = require('./loginForm')
const ProfileMenu = require('./profileMenu')
let sheetBlips;

const USE_AUTHENTICATION = process.env.USE_AUTHENTICATION
const RING_LABELS = (process.env.RING_LABELS || '').split(',')
// const SEGMENT_LABELS = process.env.SEGMENT_LABELS

const plotRadar = function (title, blips, currentRadarName, alternativeRadars) {
  if (title.endsWith('.csv')) {
    title = title.substring(0, title.length - 4)
  }
  document.title = title
  d3.selectAll('.loading').remove()

  var rings = _.map(_.uniqBy(blips, 'ring'), 'ring')
  var ringMap = {}
  var maxRings = 4
  var allBlips = []
  var allBlipNames = []
  var blipByName = {}

  _.each(rings, function (ringName, i) {
    if (i === maxRings) {
      throw new MalformedDataError(ExceptionMessages.TOO_MANY_RINGS)
    }
    ringMap[ringName] = new Ring(ringName, i)
  })

  var segments = {}
  _.each(blips, function (blip) {
    if (!segments[blip.quadrant]) {
      segments[blip.quadrant] = new Quadrant(blip.quadrant)
    }

    const processedBlip = new Blip(blip, ringMap[blip.ring])
    if (!allBlipNames.includes(processedBlip.name())) {
      allBlipNames.push(processedBlip.name())
      blipByName[processedBlip.name()] = processedBlip
      allBlips.push(blipByName[processedBlip.name()])
    }
    blipByName[processedBlip.name()].addHistory(processedBlip)

    if (blip.state && blip.state.toLowerCase() === 'archived') return
    segments[blip.quadrant].add(processedBlip)
  })

  var radar = new Radar(RING_LABELS)
  radar.setBlips(allBlips)
  _.each(segments, function (segment) {
    radar.addQuadrant(segment)
  })

  if (alternativeRadars !== undefined) {
    alternativeRadars.forEach(function (sheetName) {
      radar.addAlternative(sheetName)
    })
  }

  if (currentRadarName !== undefined) {
    radar.setCurrentSheet(currentRadarName)
  }

  new GraphingRadar(500, radar).init().plot()
}

const GoogleSheet = function (sheetReference, sheetName) {
  var self = {}

  self.build = function () {
    function getSheetData (header, rowArray) {
      var data = [] // create an empty array to hold spreadsheet data

      // loop through each row in the spreadsheet
      for (var currentRow = 1; currentRow < rowArray.length; currentRow++) {
        // Create an object to hold the data from the current row
        var obj = {}

        // loop through each column in the current row of the spreadshset
        for (var rowColumn = 0; rowColumn < header.length; rowColumn++) {
          obj[header[rowColumn]] = rowArray[currentRow][rowColumn]
        }

        data.push(obj)
      }
      return data
    }

    var sheet = new Sheet(sheetReference)
    sheet.getSheet().then(
      (sheetResponse) => {
        const sheetName = sheetResponse.result.sheets[0].properties.title
        sheet.getData(sheetName + '!A1:AA')
          .then((response) => {
            response.result.values.forEach((value) => {
              var contentValidator = new ContentValidator(response.result.values[0])
              contentValidator.verifyContent()
              contentValidator.verifyHeaders()
            })

            const header = response.result.values[0]
            const all = response.result.values
            const objectArray = getSheetData(header, all)
            all.shift()
            var blips = _.map(objectArray, new InputSanitizer().sanitize)

            sheetBlips = new BlipCache(blips)

            plotRadar(sheetName, blips)
          })
      },
      (error) => {
        if (error.status === 403) {
          plotErrorMessage(new UnauthorizedError(ExceptionMessages.UNAUTHORIZED))
        } else if (error.status === 404) {
          plotErrorMessage(new SheetNotFoundError(ExceptionMessages.SHEET_NOT_FOUND))
        }
        // sheet.validate(function (error) {
        //   if (!error) {
        //     Tabletop.init({
        //       key: sheet.id,
        //       callback: createBlips
        //     })
        //     return
        //   }

        // if (error instanceof SheetNotFoundError) {
        //   plotErrorMessage(error)
        //   return
        // }
        // self.authenticate(false)
      }
    )

    // function createBlips (__, tabletop) {
    //   try {
    //     if (!sheetName) {
    //       sheetName = tabletop.foundSheetNames[0]
    //     }
    //     var columnNames = tabletop.sheets(sheetName).columnNames

    //     var contentValidator = new ContentValidator(columnNames)
    //     contentValidator.verifyContent()
    //     contentValidator.verifyHeaders()

    //     var all = tabletop.sheets(sheetName).all()
    //     var blips = _.map(all.shift(), new InputSanitizer().sanitize)

    //     plotRadar(tabletop.googleSheetName + ' - ' + sheetName, blips, sheetName, tabletop.foundSheetNames)
    //   } catch (exception) {
    //     plotErrorMessage(exception)
    //   }
    // }
  }

  function createBlipsForProtectedSheet (documentTitle, values, sheetNames) {
    if (!sheetName) {
      sheetName = sheetNames[0]
    }
    values.forEach(function (value) {
      var contentValidator = new ContentValidator(values[0])
      contentValidator.verifyContent()
      contentValidator.verifyHeaders()
    })

    const all = values
    const header = all.shift()
    var blips = _.map(all, blip => new InputSanitizer().sanitizeForProtectedSheet(blip, header))

    sheetBlips.push(...blips)

    plotRadar(documentTitle + ' - ' + sheetName, blips, sheetName, sheetNames)
  }

  self.authenticate = function (force = false, callback) {
    GoogleAuth.loadGoogle(function (e) {
      GoogleAuth.login(_ => {
        var sheet = new Sheet(sheetReference)
        sheet.processSheetResponse(sheetName, createBlipsForProtectedSheet, error => {
          if (error.status === 403) {
            plotUnauthorizedErrorMessage()
          } else {
            plotErrorMessage(error)
          }
        })
        if (callback) { callback() }
      }, force)
    })
  }

  self.init = function () {
    plotLoading()
    return self
  }

  return self
}

const CSVDocument = function (url) {
  var self = {}

  self.build = function () {
    d3.csv(url, createBlips)
  }

  var createBlips = function (data) {
    try {
      var columnNames = data['columns']
      delete data['columns']
      var contentValidator = new ContentValidator(columnNames)
      contentValidator.verifyContent()
      contentValidator.verifyHeaders()
      var blips = _.map(data, new InputSanitizer().sanitize)

      plotRadar(FileName(url), blips, 'CSV File', [])
    } catch (exception) {
      plotErrorMessage(exception)
    }
  }

  self.init = function () {
    plotLoading()
    return self
  }

  return self
}

const DomainName = function (url) {
  var search = /.+:\/\/([^\\/]+)/
  var match = search.exec(decodeURIComponent(url.replace(/\+/g, ' ')))
  return match == null ? null : match[1]
}

const FileName = function (url) {
  var search = /([^\\/]+)$/
  var match = search.exec(decodeURIComponent(url.replace(/\+/g, ' ')))
  if (match != null) {
    var str = match[1]
    return str
  }
  return url
}

const GoogleSheetInput = function () {
  var self = {}
  self.cleanUpRender = function () {
    d3.select('.input-sheet').remove()
  }

  self.render = function () {
    const USE_GOOGLESHEET = process.env.USE_GOOGLESHEET
    const GOOGLE_SHEET = process.env.GOOGLE_SHEET
    var domainName = DomainName(window.location.search.substring(1))
    var queryString = window.location.href.match(/sheetId(.*)/)
    var queryParams = queryString ? QueryParams(queryString[0]) : {};

    if (USE_GOOGLESHEET) {
      domainName = DomainName(GOOGLE_SHEET.substring(1));
      queryString = GOOGLE_SHEET;
      queryParams = Object.assign({}, queryParams, { sheetId: GOOGLE_SHEET });
    }

    self.cleanUpRender()
    let sheet
    if (self.isLoggedIn && domainName && queryParams.sheetId.endsWith('csv')) {
      sheet = CSVDocument(queryParams.sheetId)
      sheet.init().build()
    } else if (self.isLoggedIn && domainName && domainName.endsWith('google.com') && queryParams.sheetId) {
      sheet = GoogleSheet(queryParams.sheetId, queryParams.sheetName)
      console.log(queryParams.sheetName)

      sheet.init().build()
    } else {
      var content = d3.select('body')
        .append('div')
        .attr('class', 'input-sheet')
      setDocumentTitle()

      plotLogo(content, self.isLoggedIn)

      var bannerText = '<div><h1>Build your own radar</h1><p>Once you\'ve <a href ="https://www.thoughtworks.com/radar/byor">created your Radar</a>, you can use this service' +
        ' to generate an <br />interactive version of your Technology Radar. Not sure how? <a href ="https://www.thoughtworks.com/radar/how-to-byor">Read this first.</a></p></div>'

      plotBanner(content, bannerText)

      if (self.isLoggedIn) {
        content
          .append('div')
          .attr('class', 'input-sheet__form')
        plotForm(content)
      } else {
        LoginForm.build(content)
      }

      plotFooter(content)
    }
  }

  self.build = () => {
    if (USE_AUTHENTICATION) {
      GoogleAuth.isAuthorized((isLoggedIn) => {
        self.isLoggedIn = isLoggedIn
        self.render()
      })
    } else {
      self.isLoggedIn = true
      self.render()
    }
  }

  return self
}

function setDocumentTitle () {
  document.title = 'Build your own Radar'
}

function plotLoading (content) {
  content = d3.select('main')
    .append('div')
    .attr('class', 'loading')
    .append('div')
    .attr('class', 'input-sheet')

  setDocumentTitle()

  plotLogo(content)

  var bannerText = '<h1>Building your radar...</h1><p>Your Technology Radar will be available in just a few seconds</p>'
  plotBanner(content, bannerText)
  plotFooter(content)
}

function plotLogo (content) {
  const header = d3.select('header')

  const logo = header
    .append('div')
    .attr('class', 'input-sheet__logo')

  logo.html('<a href="https://www.thoughtworks.com"><img src="/images/tw-logo.png" / ></a>')

  ProfileMenu.build(header)
}

function plotFooter (content) {
  const footer = d3.select('footer')

  footer.append('div')
    .attr('class', 'footer-content')
    .append('p')
    .html(`Powered by <a href="https://www.thoughtworks.com"> ThoughtWorks</a>.
      By using this service you agree to
      <a href="https://www.thoughtworks.com/radar/tos">ThoughtWorks' terms of use</a>.
      You also agree to our <a href="https://www.thoughtworks.com/privacy-policy">privacy policy</a>,
      which describes how we will gather, use and protect any personal data contained in your public Google Sheet.
      This software is <a href="https://github.com/thoughtworks/build-your-own-radar">open source</a> and
      available for download and self-hosting.`)
}

function plotBanner (content, text) {
  content.append('div')
    .attr('class', 'input-sheet__banner')
    .html(text)
}

function plotForm (content) {
  content.select('.input-sheet__form')
    .append('p')
    .html('<strong>Enter the URL of your <a href="https://www.thoughtworks.com/radar/how-to-byor" target="_blank">Google Sheet or CSV</a> file below…</strong>')

  var form = content.select('.input-sheet__form').append('form')
    .attr('method', 'get')

  form.append('input')
    .attr('type', 'text')
    .attr('name', 'sheetId')
    .attr('placeholder', 'e.g. https://docs.google.com/spreadsheets/d/<sheetid> or hosted CSV file')
    .attr('required', '')

  form.append('button')
    .attr('type', 'submit')
    .append('a')
    .attr('class', 'button')
    .text('Build my radar')

  form.append('p').html("<a href='https://www.thoughtworks.com/radar/how-to-byor'>Need help?</a>")
}

function plotErrorMessage (exception) {
  var message = 'Oops! It seems like there are some problems with loading your data. '

  var content = d3.select('body')
    .append('div')
    .attr('class', 'input-sheet')
  setDocumentTitle()

  plotLogo(content)

  var bannerText = '<div><h1>Build your own radar</h1><p>Once you\'ve <a href ="https://www.thoughtworks.com/radar/byor">created your Radar</a>, you can use this service' +
    ' to generate an <br />interactive version of your Technology Radar. Not sure how? <a href ="https://www.thoughtworks.com/radar/how-to-byor">Read this first.</a></p></div>'

  plotBanner(content, bannerText)

  d3.selectAll('.loading').remove()
  message = "Oops! We can't find the Google Sheet you've entered"
  var faqMessage = 'Please check <a href="https://www.thoughtworks.com/radar/how-to-byor">FAQs</a> for possible solutions.'
  if (exception instanceof MalformedDataError) {
    message = message.concat(exception.message)
  } else if (exception instanceof UnauthorizedError) {
    message = exception.message
  } else if (exception instanceof SheetNotFoundError) {
    message = exception.message
  } else {
    console.error(exception)
  }

  const container = content.append('div').attr('class', 'error-container')
  var errorContainer = container.append('div')
    .attr('class', 'error-container__message')
  errorContainer.append('div').append('p')
    .html(message)
  errorContainer.append('div').append('p')
    .html(faqMessage)

  var homePageURL = window.location.protocol + '//' + window.location.hostname
  homePageURL += (window.location.port === '' ? '' : ':' + window.location.port)
  var homePage = '<a href=' + homePageURL + '>GO BACK</a>'

  errorContainer.append('div').append('p')
    .html(homePage)

  plotFooter(content)
}

function plotUnauthorizedErrorMessage () {
  var content = d3.select('body')
    .append('div')
    .attr('class', 'input-sheet')
  setDocumentTitle()

  plotLogo(content)

  var bannerText = '<div><h1>Build your own radar</h1></div>'

  plotBanner(content, bannerText)

  d3.selectAll('.loading').remove()
  const currentUser = GoogleAuth.geEmail()
  let homePageURL = window.location.protocol + '//' + window.location.hostname
  homePageURL += (window.location.port === '' ? '' : ':' + window.location.port)
  const goBack = '<a href=' + homePageURL + '>GO BACK</a>'
  const message = `<strong>Oops!</strong> Looks like you are accessing this sheet using <b>${currentUser}</b>, which does not have permission.Try switching to another account.`

  const container = content.append('div').attr('class', 'error-container')

  const errorContainer = container.append('div')
    .attr('class', 'error-container__message')

  errorContainer.append('div').append('p')
    .attr('class', 'error-title')
    .html(message)

  const button = errorContainer.append('button')
    .attr('class', 'button switch-account-button')
    .text('SWITCH ACCOUNT')

  errorContainer.append('div').append('p')
    .attr('class', 'error-subtitle')
    .html(`or ${goBack} to try a different sheet.`)

  button.on('click', _ => {
    var queryString = window.location.href.match(/sheetId(.*)/)
    var queryParams = queryString ? QueryParams(queryString[0]) : {}
    const sheet = GoogleSheet(queryParams.sheetId, queryParams.sheetName)
    sheet.authenticate(true, _ => {
      content.remove()
    })
  })
}

module.exports = GoogleSheetInput
