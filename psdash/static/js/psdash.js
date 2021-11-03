
function escape_regexp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function replace_all(find, replace, str) {
  return str.replace(new RegExp(escape_regexp(find), 'g'), replace);
}

function init_log() {
    var $log = $("#log");
    function scroll_down($el) {
        $el.scrollTop($el[0].scrollHeight);
    }

    function read_log() {
        var $el = $("#log-content");
        var mode = $el.data("mode");
        if(mode != "tail") {
            return;
        }

        $.get($log.data("read-log-url"), function (resp) {
            // only scroll down if the scroll is already at the bottom.
            if(($el.scrollTop() + $el.innerHeight()) >= $el[0].scrollHeight) {
                $el.append(resp);
                scroll_down($el);
            } else {
                $el.append(resp);
            }
        });
    }

    function exit_search_mode() {
        var $el = $("#log-content");
        $el.data("mode", "tail");
        var $controls = $("#log").find(".controls");
        $controls.find(".mode-text").text("Tail mode (Press s to search)");
        $controls.find(".status-text").hide();

        $.get($log.data("read-log-tail-url"), function (resp) {
            $el.text(resp);
            scroll_down($el);
            $("#search-input").val("").blur();
        });
    }

    $("#scroll-down-btn").click(function() {
        scroll_down($el);
    });

    $("#search-form").submit(function(e) {
        e.preventDefault();

        var val = $("#search-input").val();
        if(!val) return;

        var $el = $("#log-content");
        var filename = $el.data("filename");
        var params = {
            "filename": filename,
            "text": val
        };

        $el.data("mode", "search");
        $("#log").find(".controls .mode-text").text("Search mode (Press enter for next, escape to exit)");

        $.get($log.data("search-log-url"), params, function (resp) {
            var $log = $("#log");
            $log.find(".controls .status-text").hide();
            $el.find(".found-text").removeClass("found-text");

            var $status = $log.find(".controls .status-text");

            if(resp.position == -1) {
                $status.text("EOF Reached.");
            } else {
                // split up the content on found pos.
                var content_before = resp.content.slice(0, resp.buffer_pos);
                var content_after = resp.content.slice(resp.buffer_pos + params["text"].length);

                // escape html in log content
                resp.content = $('<div/>').text(resp.content).html();

                // highlight matches
                var matched_text = '<span class="matching-text">' + params['text'] + '</span>';
                var found_text = '<span class="found-text">' + params["text"] + '</span>';
                content_before = replace_all(params["text"], matched_text, content_before);
                content_after = replace_all(params["text"], matched_text, content_after);
                resp.content = content_before + found_text + content_after;
                $el.html(resp.content);

                $status.text("Position " + resp.position + " of " + resp.filesize + ".");
            }

            $status.show();
        });
    });
    
    $(document).keyup(function(e) {
        var mode = $el.data("mode");
        if(mode != "search" && e.which == 83) {
            $("#search-input").focus();
        }
        // Exit search mode if escape is pressed.
        else if(mode == "search" && e.which == 27) {
            exit_search_mode();
        }
    });

    setInterval(read_log, 1000);
    var $el = $("#log-content");
    scroll_down($el);
}

var skip_updates = false;
var smoothie_chart_options = {
	millisPerPixel:300,
	interpolation:'linear',
	grid: {
		fillStyle:'transparent',
		millisPerLine:6000,
		verticalSections:4
	},
	labels: {
		disabled: true
	},
	maxValue:100,minValue:0
};
var smoothie_timeserie_options = {
	lineWidth:0.6,
	strokeStyle:'#1c71d8',
	fillStyle:'rgba(153,193,241,0.30)'
};
var chart_timeseries = {};

function init_updater() {
    function update() {
        if (skip_updates) return;

        $.ajax({
            url: location.href,
            cache: false,
            dataType: "html",
            success: function(resp){
		let doc = new DOMParser().parseFromString(resp, 'application/xml');

	    let currentDynamicNodes = $("#psdash").find(".dynamic-value");
		if(currentDynamicNodes.length>0)
		{
		    // Just update the dynamic nodes
		    let newDynamicNodes = doc.querySelectorAll(".dynamic-value");

		    for(let i=0; i<currentDynamicNodes.length; ++i) {
		        currentDynamicNodes[i].outerHTML = newDynamicNodes[i].outerHTML;
		    }

			// Now create/update the charts, if needed
			$("#psdash").find(".smoothiechart").each(function(index) {
				let graph_variable = $(this).data("graph-variable");
				if (!chart_timeseries[graph_variable]) {
					// no chart created yet for that canvas: do it now
					let new_chart = new SmoothieChart(smoothie_chart_options);
					new_chart.streamTo($(this)[0], 1000 /*delay*/);
					let new_chart_timeseries = new TimeSeries();
					new_chart.addTimeSeries(new_chart_timeseries, smoothie_timeserie_options);

					chart_timeseries[graph_variable] = new_chart_timeseries;
				}
				// now that the timeseries is there, add the value
		        let elt = $("#" + graph_variable);
		        let elt_value = elt.text().slice(0, -1);
		        chart_timeseries[graph_variable].append(new Date().getTime(), elt_value);
			});
		}
		else
		{
		    $("#psdash").find(".main-content").html(resp);
		}

            },
            complete: function(xhr,status) {
            	// whatever happens, setup the next update
           	    setTimeout(update, 3000);
            }
        });
    }

    setTimeout(update, 3000);
}

function init_connections_filter() {
    var $content = $("#psdash");
    $content.on("change", "#connections-form select", function () {
        $content.find("#connections-form").submit();
    });
    $content.on("focus", "#connections-form select, #connections-form input", function () {
        skip_updates = true;
    });
    $content.on("blur", "#connections-form select, #connections-form input", function () {
        skip_updates = false;
    });
    $content.on("keypress", "#connections-form input[type='text']", function (e) {
        if (e.which == 13) {
            $content.find("#connections-form").submit();
        }
    });
}

$(document).ready(function() {
    init_connections_filter();

    if($("#log").length == 0) {
        init_updater();
    } else {
        init_log();
    }
});
