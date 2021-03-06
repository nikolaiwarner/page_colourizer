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

var page_colourizer = {
  random_palette_url: 'http://www.colourlovers.com/api/palettes/random',
  random_pattern_url: 'http://www.colourlovers.com/api/patterns/random',

  store_info: function(data, index, callback) {
    var type = data.is_pattern ? 'pattern' : 'palette';
    index = parseInt(index, 10);
    data = {id: data.id, index: index, type: type, hex_codes: data.hex_codes,
            title: data.title, url: data.url, image_url: data.image_url,
            user_name: data.user_name};
    chrome.storage.sync.set({'colourizer_data': data}, function() {
      callback();
    });
  },

  get_stored_info: function(callback) {
    chrome.storage.sync.get('colourizer_data', function(data) {
      callback(data.colourizer_data);
    });
  },

  get_color_sources: function(callback) {
    var me = this;
    chrome.storage.sync.get('colourizer_options', function(opts) {
      opts = opts.colourizer_options;
      var sources = [];
      if (opts.color_source != 'patterns_only') {
        sources = sources.concat([
          {is_pattern: false, url: me.random_palette_url}
        ]);
      }
      if (opts.color_source == 'palettes_and_patterns' ||
          opts.color_source == 'patterns_only') {
        sources = sources.concat([
          {is_pattern: true, url: me.random_pattern_url}
        ]);
      }
      callback(sources);
    });
  },

  get_color_source: function(callback) {
    this.get_color_sources(function(sources) {
      callback(sources[Math.floor(Math.random() * sources.length)]);
    });
  },

  load_cl_url: function(url, is_pattern, callback) {
    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    var me = this;
    req.onload = function(e) {
      me.extract_cl_data_from_xml(e, is_pattern, callback);
    }.bind(this);
    req.send(null);
  },

  load_random_cl_data: function(callback) {
    var me = this;
    this.get_color_source(function(source) {
      me.load_cl_url(source.url, source.is_pattern, callback);
    });
  },

  load_cl_data_by_id: function(info, callback) {
    var url = 'http://www.colourlovers.com/api/' + info.type + '/' + info.id;
    this.load_cl_url(url, info.type == 'pattern', callback);
  },

  extract_cl_data_from_xml: function(e, is_pattern, callback) {
    var xml = e.target.responseXML;
    var hex_nodes = xml.querySelectorAll('hex');
    var title = xml.querySelector('title').textContent;
    var url = xml.querySelector('url').textContent;
    var image_url = xml.querySelector('imageUrl').textContent;
    var user_name = xml.querySelector('userName').textContent;
    var id = xml.querySelector('id').textContent;
    var hex_codes = [];
    for (var i=0; i<hex_nodes.length; i++) {
      hex_codes[i] = '#' + hex_nodes[i].textContent;
    }
    callback({hex_codes: hex_codes, title: title, url: url,
              image_url: image_url, user_name: user_name, id: id,
              is_pattern: is_pattern});
  },

  has_color: function(rgb_code) {
    if (rgb_code.substring(0, 4) == 'rgb(') {
      return true;
    }
    return rgb_code.substring(0, 5) == 'rgba(' &&
           rgb_code.substring(rgb_code.length - 3) != ' 0)';
  },

  get_colored_elements: function(prop, should_include) {
    var color_hash = {};
    var add_to_hash = function(key, el) {
      if (color_hash.hasOwnProperty(key)) {
        color_hash[key] = color_hash[key].concat([el]);
      } else {
        color_hash[key] = [el];
      }
    };
    $('*').each(function() {
      var el = $(this);
      var prop_value = el.css(prop);
      if (should_include(el, prop_value)) {
        add_to_hash(prop_value, el);
      }
    });
    return color_hash;
  },

  get_background_colored_elements: function() {
    var me = this;
    return this.get_colored_elements('background', function(el, prop_value) {
      var rgb_code = prop_value.split(')')[0] + ')';
      if (me.has_color(rgb_code)) {
        return true;
      }
      var has_bg_image = prop_value.indexOf('url(') !== -1;
      var text_indent = parseInt(el.css('text-indent').replace(/px$/, ''), 10);
      var has_neg_text_indent = text_indent < 0;
      var has_bg_position = el.css('background-position') !== '0% 0%';
      // Common to have images that replace text with a negative text-indent,
      // so assume background image with negative text indent means it's a logo
      // and we should leave it alone.
      return has_bg_image && !has_neg_text_indent && !has_bg_position;
    });
  },

  get_text_colored_elements: function() {
    var me = this;
    return this.get_colored_elements('color', function(el, prop_value) {
      return me.has_color(prop_value);
    });
  },

  get_bordered_elements: function() {
    var me = this;
    return this.get_colored_elements('border-color', function(el, prop_value) {
      return me.has_color(prop_value);
    });
  },

  get_text_shadowed_elements: function() {
    var me = this;
    return this.get_colored_elements('text-shadow', function(el, prop_value) {
      if (prop_value == 'none') {
        return false;
      }
      var shadow_rgb = prop_value.split(')')[0] + ')';
      return me.has_color(shadow_rgb);
    });
  },

  split_rgb_code: function(rgb_code) {
    var parts = rgb_code.split(', ');
    var r = parseInt(parts[0].split('(')[1], 10);
    var g = parseInt(parts[1], 10);
    var b = parseInt(parts[2].split(')')[0], 10);
    return [r, g, b];
  },

  constrain_rgb: function(piece) {
    piece = piece > 255 ? 255 : piece;
    piece = piece < 0 ? 0 : piece;
    return Math.round(piece);
  },

  scale_color: function(rgb_code, scale) {
    var split_code = this.split_rgb_code(rgb_code);
    var r = split_code[0], g = split_code[1], b = split_code[2];
    r += (255 * scale) * (r / (r + g + b));
    r = this.constrain_rgb(r);
    g += (255 * scale) * (g / (r + g + b));
    g = this.constrain_rgb(g);
    b += (255 * scale) * (b / (r + g + b));
    b = this.constrain_rgb(b);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
  },

  colourize_elements: function(hex_codes, el_hash, idx, callback) {
    var num_colors = hex_codes.length;
    for (var orig_color in el_hash) {
      var new_color = hex_codes[idx];
      var elements = el_hash[orig_color];
      for (var i=0; i<elements.length; i++) {
        var selector = $(elements[i]);
        callback(selector, new_color);
      }
      idx = (idx + 1) % num_colors;
    }
  },

  get_background_color: function(el) {
    var background = el.css('background-color');
    if (background !== 'rgba(0, 0, 0, 0)') {
      return background;
    }
    if (el.is('body')) {
      return false;
    }
    return this.get_background_color(el.parent());
  },

  // See http://stackoverflow.com/a/3118280/38743
  y: function(rgb_code) {
    var split_code = this.split_rgb_code(rgb_code);
    var r = split_code[0], g = split_code[1], b = split_code[2];
    r = Math.pow(r / 255, 2.2);
    g = Math.pow(g / 255, 2.2);
    b = Math.pow(b / 255, 2.2);
    return 0.2126*r + 0.7151*g + 0.0721*b;
  },

  get_color_ratio: function(rgb_code1, rgb_code2) {
    return (this.y(rgb_code1) + 0.05) / (this.y(rgb_code2) + 0.05);
  },

  get_text_color_for_bg: function(rgb_bg) {
    var luminance = this.y(rgb_bg); // 1 = white, 0 = black
    if (luminance < 0.25) { // close to black background
      return 'rgb(255, 255, 255)';
    }
    if (luminance > 0.75) { // close to white background
      return 'rgb(0, 0, 0)';
    }
    if (luminance > 0.5) { // on the whiter side
      return this.scale_color(rgb_bg, -1 * luminance - 1);
    }
    return this.scale_color(rgb_bg, luminance + 1);
  },

  set_text_color_for_bg: function(el) {
    var rgb_bg = this.get_background_color(el);
    if (rgb_bg) {
      el.css('color', this.get_text_color_for_bg(rgb_bg), 'important');
    }
  },

  parent_has_same_background_color: function(el, color) {
    var parent = el.parent();
    if (parent) {
      var parent_bg = this.get_background_color(parent);
      return parent_bg !== undefined && parent_bg == color;
    }
    return false;
  },

  colourize_bg_elements: function(hex_codes, idx) {
    var me = this;
    var elements = this.get_background_colored_elements();
    this.colourize_elements(hex_codes, elements, idx, function(el, color) {
      el.css('background-color', color, 'important');
      color = el.css('background-color');
      if (me.parent_has_same_background_color(el, color)) {
        color = me.scale_color(color, 0.5);
        el.css('background-color', color, 'important');
      }
      el.css('background-image', 'none', 'important');
      me.set_text_color_for_bg(el);
    });
  },

  colourize_text_elements: function(hex_codes, idx) {
    var me = this;
    var elements = this.get_text_colored_elements();
    this.colourize_elements(hex_codes, elements, idx, function(el, color) {
      me.set_text_color_for_bg(el);
    });
  },

  colourize_border_elements: function(hex_codes, idx) {
    var me = this;
    var elements = this.get_bordered_elements();
    this.colourize_elements(hex_codes, elements, idx, function(el, color) {
      var rgb_bg = me.get_background_color(el);
      var border_color;
      if (rgb_bg) {
        border_color = me.scale_color(rgb_bg, -0.25);
      } else {
        border_color = color;
      }
      el.css('border-color', border_color, 'important');
    });
  },

  colourize_text_shadow_elements: function(hex_codes, idx) {
    var me = this;
    var elements = this.get_text_shadowed_elements();
    this.colourize_elements(hex_codes, elements, idx, function(el, color) {
      var shadow = el.css('text-shadow');
      var shadow_props = shadow.split(')')[1];
      var rgb_bg = me.get_background_color(el);
      var shadow_color;
      if (rgb_bg) {
        shadow_color = me.scale_color(rgb_bg, -0.5);
      } else {
        shadow_color = 'rgba(0, 0, 0, 0.3)';
      }
      el.css('text-shadow', shadow_color + shadow_props);
    });
  },

  set_bg_image: function(data) {
    if (data.is_pattern) {
      $('body').css('background-image', 'url("' + data.image_url + '")',
                    'important').
                css('background-repeat', 'repeat', 'important').
                css('background-position', 'left top', 'important');
    }
  },

  colourize_page: function(data, idx) {
    var hex_codes = data.hex_codes;
    this.colourize_bg_elements(hex_codes, idx);
    this.colourize_text_elements(hex_codes, idx);
    this.colourize_border_elements(hex_codes, idx);
    this.colourize_text_shadow_elements(hex_codes, idx);
    this.set_bg_image(data);
  },

  on_popup_opened: function(callback) {
    var me = this;
    this.get_stored_info(function(info) {
      if (info) {
        me.load_cl_data_by_id(info, function(data) {
          callback(data);
        });
      } else {
        me.load_random_cl_data(function(data) {
          var index = 0;
          callback(data);
          me.colourize_page(data, index);
          me.store_info(data, index, function() {
            // no-op
          });
        });
      }
    });
  },

  on_new_colors_requested: function(callback) {
    var me = this;
    this.load_random_cl_data(function(data) {
      var index = 0;
      callback(data);
      me.colourize_page(data, index);
      me.store_info(data, index, function() {
        // no-op
      });
    });
  },

  shuffle_colors: function() {
    var me = this;
    this.get_stored_info(function(data) {
      var new_index = (data.index + 1) % data.hex_codes.length;
      me.colourize_page(data, new_index);
      me.store_info(data, new_index, function() {
        // no-op
      });
    });
  }
};

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  if (request.greeting == 'popup_opened') {
    page_colourizer.on_popup_opened(function(data) {
      sendResponse(data);
    });
  } else if (request.greeting == 'shuffle_colors') {
    page_colourizer.shuffle_colors();
    sendResponse();
  } else if (request.greeting == 'new_colors') {
    page_colourizer.on_new_colors_requested(function(data) {
      sendResponse(data);
    });
  } else {
    sendResponse({});
  }
});

chrome.storage.sync.get('colourizer_options', function(opts) {
  opts = opts.colourizer_options;
  if (opts.colour_frenzy) {
    page_colourizer.on_popup_opened(function(data, idx) {
      // no-op
    });
  }
});
