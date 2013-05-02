/*
 * Copyright 2013 Sarah Vessels
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-40563451-1']);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

var colourizer_popup = {
  set_favorite_link: function(palette_data) {
    var url = 'http://www.colourlovers.com/op/add/favorite/p/' +
              palette_data.palette_id;
    $('#favorite-container a').attr('href', url);
    $('#favorite-container').fadeIn().css('display', 'inline-block');
  },

  set_love_link: function(palette_data) {
    var url = 'http://www.colourlovers.com/ajax/add/score/p/' +
              palette_data.palette_id;
    $('#love-container a').attr('href', url).
                           attr('data-redirect', palette_data.url);
    $('#love-container').fadeIn().css('display', 'inline-block');
  },

  on_popup_link_click: function() {
    var a = $(this);
    var url = a.attr('href');
    if (a[0].hasAttribute('data-redirect')) {
      var req = new XMLHttpRequest();
      req.open("GET", url, true);
      req.onload = function(e) {
        chrome.tabs.create({url: a.attr('data-redirect')});
      }.bind(this);
      req.send(null);
    } else if (url != '#') {
      chrome.tabs.create({url: url});
    }
    return false;
  },

  set_popup_title: function(palette_data) {
    $('h1 a span').text(palette_data.title);
    $('h1 a').attr('href', palette_data.url);
    $('h1 a img').attr('alt', palette_data.title.replace(/"/g, "'")).
                  attr('src', palette_data.image_url).
                  attr('width', '228').
                  attr('height', '161');
    $('h1').fadeIn();
  },

  set_palette_creator: function(palette_data) {
    var url = 'http://www.colourlovers.com/lover/' + palette_data.user_name;
    $('h2 a').attr('href', url).text('by ' + palette_data.user_name);
    $('h2').fadeIn();
  },

  send_shuffle_colors_request: function(tab, palette_data, idx, callback) {
    chrome.tabs.sendRequest(
      tab.id,
      {greeting: 'shuffle_colors', palette_data: palette_data, index: idx},
      callback
    );
  },

  on_shuffle_colors_clicked: function(link, tab, palette_data) {
    if (link.hasClass('disabled')) {
      return;
    }
    link.addClass('disabled');
    $('#spinner').show();
    var cur_index = parseInt(link.attr('data-index'), 10);
    this.send_shuffle_colors_request(
      tab, palette_data, cur_index,
      function(new_index) {
        link.attr('data-index', new_index);
        link.removeClass('disabled');
        $('#spinner').hide();
      }
    );
  },

  set_shuffle_colors_index: function(index) {
    $('a#shuffle_colors').attr('data-index', index);
  },

  populate_popup: function(tab, palette_data, idx) {
    this.set_popup_title(palette_data);
    this.set_palette_creator(palette_data);
    this.set_favorite_link(palette_data);
    this.set_love_link(palette_data);
    this.set_shuffle_colors_index(idx);
    var me = this;
    $('body a').click(this.on_popup_link_click);
    $('a#shuffle-colors').blur().click(function() {
      me.on_shuffle_colors_clicked($(this), tab, palette_data);
    });
  }
};

document.addEventListener('DOMContentLoaded', function() {
  chrome.tabs.getSelected(null, function(tab) {
    chrome.tabs.sendRequest(
      tab.id,
      {greeting: 'load_random_palette'},
      function(palette_data, idx) {
        colourizer_popup.populate_popup(tab, palette_data, idx);
      }
    );
  });
});
