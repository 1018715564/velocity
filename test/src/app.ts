///<reference types="qunit" />
///<reference path="../../index.d.ts" />
///<reference path="1. Core/_all.d.ts" />
///<reference path="2. Option/_all.d.ts" />
///<reference path="3. Command/_all.d.ts" />
///<reference path="4. Feature/_all.d.ts" />
///<reference path="5. UI Pack/_all.d.ts" />
///<reference path="6. Normalizations/_all.d.ts" />
/*
 * VelocityJS.org (C) 2014-2017 Julian Shapiro.
 *
 * Licensed under the MIT license. See LICENSE file in the project root for details.
 */

interface QUnit {
	todo(name: string, callback: (assert: Assert) => void): void;
}

interface Assert {
	close: {
		(actual: number, expected: number, maxDifference: number, message: string): void;
		percent(actual: number, expected: number, maxPercentDifference: number, message: string): void;
	};
	notClose: {
		(actual: number, expected: number, minDifference: number, message: string): void;
		percent(actual: number, expected: number, minPercentDifference: number, message: string): void;
	};
}

// Needed tests:
// - new stop behvaior
// - e/p/o shorthands

/* IE detection: https://gist.github.com/julianshapiro/9098609 */
var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
	isAndroid = /Android/i.test(navigator.userAgent),
	$ = ((window as any).jQuery || (window as any).Zepto),
	$qunitStage = document.getElementById("qunit-stage"),
	defaultStyles = {
		opacity: 1,
		width: 1,
		height: 1,
		marginBottom: 1,
		colorGreen: 200,
		textShadowBlur: 3
	},
	defaultProperties: VelocityProperties = {
		opacity: defaultStyles.opacity / 2,
		width: defaultStyles.width * 2,
		height: defaultStyles.height * 2
	},
	defaultOptions: VelocityOptions = {
		queue: "",
		duration: 300,
		easing: "swing",
		begin: null,
		complete: null,
		progress: null,
		display: null,
		loop: false,
		delay: 0,
		mobileHA: true
	},
	asyncCheckDuration = (defaultOptions.duration as number) / 2,
	completeCheckDuration = (defaultOptions.duration as number) * 2,
	IE = (function() {
		if ((document as any).documentMode) {
			return (document as any).documentMode as number;
		} else {
			for (var i = 7; i > 0; i--) {
				var div = document.createElement("div");

				div.innerHTML = "<!" + "--[if IE " + i + "]><span></span><![endif]--" + ">";
				if (div.getElementsByTagName("span").length) {
					div = null;
					return i;
				}
				div = null;
			}
		}

		return undefined;
	})();

QUnit.config.reorder = false;

Velocity.defaults = defaultOptions;

function applyStartValues(element, startValues) {
	$.each(startValues, function(property, startValue) {
		element.style[property] = startValue;
	});
}

function Data(element): ElementData {
	return (element.jquery ? element[0] : element).velocityData;
}

function getNow(): number {
	return performance && performance.now ? performance.now() : Date.now();
}

let targets: HTMLDivElement[] = [];

function getTarget() {
	var div = document.createElement("div") as HTMLDivElement;

	div.className = "target";
	div.style.opacity = String(defaultStyles.opacity);
	div.style.color = "rgb(125, " + defaultStyles.colorGreen + ", 125)";
	div.style.width = defaultStyles.width + "px";
	div.style.height = defaultStyles.height + "px";
	div.style.marginBottom = defaultStyles.marginBottom + "px";
	div.style.textShadow = "0px 0px " + defaultStyles.textShadowBlur + "px red";
	$qunitStage.appendChild(div);
	targets.push(div);
	return div;
}

function freeTargets() {
	while (targets.length) {
		try {
			$qunitStage.removeChild(targets.pop());
		} catch (e) {}
	}
}

function once(func): typeof func {
	var done, result;

	return function() {
		if (!done) {
			result = func.apply(this, arguments);
			func = done = true; // Don't care about type, just let the GC collect if possible
		}
		return result;
	};
}

QUnit.testDone(function() {
	try {
		document.querySelectorAll(".velocity-animating").velocity("stop");
	} catch (e) {}
	freeTargets();
});

/* Cleanup */
QUnit.done(function(details) {
	//	$(".velocity-animating").velocity("stop");
	console.log("Total: ", details.total, " Failed: ", details.failed, " Passed: ", details.passed, " Runtime: ", details.runtime);
});

/* Helpful redirect for testing custom and parallel queues. */
// var $div2 = $("#DataBody-PropertiesDummy");
// $.fn.velocity.defaults.duration = 1000;
// $div2.velocity("scroll", { queue: "test" })
// $div2.velocity({width: 100}, { queue: "test" })
// $div2.velocity({ borderWidth: 50 }, { queue: "test" })
// $div2.velocity({height: 20}, { queue: "test" })
// $div2.velocity({marginLeft: 200}, { queue: "test" })
// $div2.velocity({paddingTop: 60});
// $div2.velocity({marginTop: 100});
// $div2.velocity({paddingRight: 40});
// $div2.velocity({marginTop: 0})
// $div2.dequeue("test")
