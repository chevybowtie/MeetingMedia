#!/usr/bin/env nodejs
var request = require('request'),
    cheerio = require('cheerio'),
    fs = require('fs'),
    _ = require('lodash');
    

// Parse the page to extract source articles and remove duplicates

function getSources(html) {
  // We use the jQuery-like cheerio module for this
  // Build a fake DOM and jQuery object
  var $ = cheerio.load(html);
  // Get all links in the CLAM schedule and Watchtower sections
  var links = [];
  $('div.docClass-CongregationMeetingSchedule a,' +
      'div.docClass-WatchtowerTOC.pub-w16 a')
      .not('ul.noMarker a')
  .each(function (i, el) {
    links.push([$(this).text(), $(this).attr('href')]);
  });
  links = _.uniqBy(links, function (x) { return x[1] });
  links = _.filter(links, function (x) { return x[0] != '' });
  links = _.filter(links, function (x) { return x[0][0] != '\n' });
  return links;
}

// Get all media for the meeting

function getMedia(lang, month, day, callback) {
  request('http://wol.jw.org/' + lang + '/wol/dt/r1/lp-e/2016/' +
          month + '/' + day, function (err, resp, html) {
    if (err) {
      callback(err);
      return;
    }
    var sources = getSources(html);
    var media = [];
    (function getSourceMedia(sources) {
      var source = sources.shift();
      if (source != undefined) {
        request('http://wol.jw.org' + source[1], function(err, resp, html) {
          if (err) {
            callback(err);
            return;
          }
          // We use the jQuery-like cheerio module for this
          // Build a fake DOM and jQuery object
          var $ = cheerio.load(html);
          // Get links to all figures
          $('figure img').each(function (i, el) {
            media.push([source[0], source[1], $(this).attr('alt'),
                          $(this).attr('src')]);
          });
          // Get the next source's media
          getSourceMedia(sources);
        });
      } else {
        media = _.uniqBy(media, function (x) { return x[3] });
        media = _.filter(media, function (x) { return x[2] != '' });
        callback(undefined, media);
      }
    })(sources);
  });
}

// Get the current media and download them

var d = new Date();

getMedia('en', d.getMonth() + 1, d.getDate(), function (err, media) {
  if (err) {
    console.log(err);
    return;
  }
  for (var i = 0; i < media.length; i++) {
    request('http://wol.jw.org' + media[i][3]).pipe(fs.createWriteStream(
      (i+1) + '. ' + media[i][0] + ' - ' + media[i][2] + '.jpg'));
  }
});
