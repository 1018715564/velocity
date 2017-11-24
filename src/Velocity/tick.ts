///<reference path="state.ts" />
/*
 * VelocityJS.org (C) 2014-2017 Julian Shapiro.
 *
 * Licensed under the MIT license. See LICENSE file in the project root for details.
 *
 * Tick
 */

namespace VelocityStatic {

	/**
	 * Call the begin method of an animation in a separate function so it can
	 * benefit from JIT compiling while still having a try/catch block.
	 */
	function callBegin(activeCall: AnimationCall) {
		try {
			let elements = activeCall.elements;

			activeCall.options.begin.call(elements, elements, activeCall);
		} catch (error) {
			setTimeout(function() {
				throw error;
			}, 1);
		}
	}

	/**
	 * Call the progress method of an animation in a separate function so it can
	 * benefit from JIT compiling while still having a try/catch block.
	 */
	function callProgress(activeCall: AnimationCall, timeCurrent: number) {
		try {
			let elements = activeCall.elements,
				percentComplete = activeCall.percentComplete,
				options = activeCall.options,
				tweenValue = activeCall.tween;

			activeCall.options.progress.call(elements,
				elements,
				percentComplete,
				Math.max(0, activeCall.timeStart + getValue(activeCall.duration, options && options.duration, defaults.duration) - timeCurrent),
				activeCall.timeStart,
				tweenValue !== undefined ? tweenValue : String(percentComplete * 100),
				activeCall);
		} catch (error) {
			setTimeout(function() {
				throw error;
			}, 1);
		}
	}

	/**************
	 Timing
	 **************/

	const FRAME_TIME = 1000 / 60;

	let ticker: (callback: FrameRequestCallback) => number,
		/**
		 * Shim for window.performance in case it doesn't exist
		 */
		performance = (function() {
			let perf = window.performance || {} as Performance;

			if (typeof perf.now !== "function") {
				let nowOffset = perf.timing && perf.timing.navigationStart ? perf.timing.navigationStart : _now();

				perf.now = function() {
					return _now() - nowOffset;
				};
			}
			return perf;
		})(),
		/* rAF shim. Gist: https://gist.github.com/julianshapiro/9497513 */
		rAFShim = ticker = (function() {
			return window.requestAnimationFrame || function(callback) {
				/* Dynamically set delay on a per-tick basis to match 60fps. */
				/* Based on a technique by Erik Moller. MIT license: https://gist.github.com/paulirish/1579671 */
				let timeCurrent = performance.now(), // High precision if we can
					timeDelta = Math.max(0, FRAME_TIME - (timeCurrent - lastTick));

				return setTimeout(function() {
					callback(timeCurrent + timeDelta);
				}, timeDelta);
			};
		})();

	/**
	 * The time that the last animation frame ran at. Set from tick(), and used
	 * for missing rAF (ie, when not in focus etc).
	 */
	export let lastTick: number = 0;

	/* Inactive browser tabs pause rAF, which results in all active animations immediately sprinting to their completion states when the tab refocuses.
	 To get around this, we dynamically switch rAF to setTimeout (which the browser *doesn't* pause) when the tab loses focus. We skip this for mobile
	 devices to avoid wasting battery power on inactive tabs. */
	/* Note: Tab focus detection doesn't work on older versions of IE, but that's okay since they don't support rAF to begin with. */
	if (!State.isMobile && document.hidden !== undefined) {
		let updateTicker = function() {
			/* Reassign the rAF function (which the global tick() function uses) based on the tab's focus state. */
			if (document.hidden) {
				ticker = function(callback: any) {
					/* The tick function needs a truthy first argument in order to pass its internal timestamp check. */
					return setTimeout(function() {
						callback(true);
					}, 16);
				};

				/* The rAF loop has been paused by the browser, so we manually restart the tick. */
				tick();
			} else {
				ticker = rAFShim;
			}
		};

		/* Page could be sitting in the background at this time (i.e. opened as new tab) so making sure we use correct ticker from the start */
		updateTicker();

		/* And then run check again every time visibility changes */
		document.addEventListener("visibilitychange", updateTicker);
	}

	let ticking: boolean;

	/* Note: All calls to Velocity are pushed to the Velocity.State.calls array, which is fully iterated through upon each tick. */
	export function tick(timestamp?: number | boolean) {
		if (ticking) {
			// Should never happen - but if we've swapped back from hidden to
			// visibile then we want to make sure
			return;
		}
		ticking = true;
		/* An empty timestamp argument indicates that this is the first tick occurence since ticking was turned on.
		 We leverage this metadata to fully ignore the first tick pass since RAF's initial pass is fired whenever
		 the browser's next tick sync time occurs, which results in the first elements subjected to Velocity
		 calls being animated out of sync with any elements animated immediately thereafter. In short, we ignore
		 the first RAF tick pass so that elements being immediately consecutively animated -- instead of simultaneously animated
		 by the same Velocity call -- are properly batched into the same initial RAF tick and consequently remain in sync thereafter. */
		if (timestamp) {
			/* We normally use RAF's high resolution timestamp but as it can be significantly offset when the browser is
			 under high stress we give the option for choppiness over allowing the browser to drop huge chunks of frames.
			 We use performance.now() and shim it if it doesn't exist for when the tab is hidden. */
			let timeCurrent = timestamp && timestamp !== true ? timestamp : performance.now(),
				deltaTime = lastTick ? timeCurrent - lastTick : FRAME_TIME,
				activeCall: AnimationCall,
				nextCall: AnimationCall,
				firstProgress: AnimationCall,
				lastProgress: AnimationCall,
				firstComplete: AnimationCall,
				lastComplete: AnimationCall;

			if (deltaTime >= defaults.minFrameTime || !lastTick) {
				lastTick = timeCurrent;

				/********************
				 Call Iteration
				 ********************/

				/* Exapand any tweens that might need it */
				while ((activeCall = State.firstNew)) {
					expandTween(activeCall);
				}
				/* Iterate through each active call. */
				for (activeCall = State.first; activeCall && activeCall !== State.firstNew; activeCall = nextCall) {
					nextCall = activeCall._next;
					let element = activeCall.element,
						data: ElementData;

					// Check to see if this element has been deleted midway
					// through the animation. If it's gone then end this
					// animation.
					if (!element.parentNode || !(data = Data(element))) {
						// TODO: Remove safely - decrease count, delete data, remove from arrays
						freeAnimationCall(activeCall);
						continue;
					}
					// Don't bother getting until we can use these.
					let timeStart = activeCall.timeStart,
						options = activeCall.options,
						paused = activeCall.paused,
						firstTick = !timeStart;

					// If this is the first time that this call has been
					// processed by tick() then we assign timeStart now so that
					// it's value is as close to the real animation start time
					// as possible.
					if (firstTick) {
						let queue = getValue(activeCall.queue, options.queue);

						timeStart = timeCurrent - deltaTime;
						if (queue !== false) {
							timeStart = Math.max(timeStart, data.lastFinishList[queue] || 0);
						}
						activeCall.timeStart = timeStart;
					}
					// If this animation is paused then skip processing unless
					// it has been set to resume.
					if (paused === true) {
						// Update the time start to accomodate the paused
						// completion amount.
						activeCall.timeStart += deltaTime;
						continue;
					} else if (paused === false) {
						// Remove pause key after processing.
						delete activeCall.paused;
					}
					let speed = getValue(activeCall.speed, options.speed, defaults.speed);

					if (!activeCall.started) {
						// Don't bother getting until we can use these.
						let delay = getValue(activeCall.delay, options.delay);

						// Make sure anything we've delayed doesn't start
						// animating yet, there might still be an active delay
						// after something has been un-paused
						if (delay) {
							if (timeStart + (delay / speed) > timeCurrent) {
								continue;
							}
							activeCall.timeStart = timeStart += delay / (delay > 0 ? speed : 1);
						}

						// TODO: Option: Sync - make sure all elements start at the same time, the behaviour of all(?) other JS libraries

						activeCall.started = true;
						// Apply the "velocity-animating" indicator class.
						CSS.Values.addClass(element, "velocity-animating");
						// The begin callback is fired once per call, not once
						// per element, and is passed the full raw DOM element
						// set as both its context and its first argument.
						if (options._started++ === 0) {
							options._first = activeCall;
							if (options.begin) {
								// Pass to an external fn with a try/catch block for optimisation
								callBegin(activeCall);
								// Only called once, even if reversed or repeated
								options.begin = undefined;
							}
						}
					}
					if (speed !== 1) {
						// On the first frame we may have a shorter delta
						let delta = Math.min(deltaTime, timeCurrent - timeStart);

						if (speed === 0) {
							// If we're freezing the animation then don't let the
							// time change
							activeCall.timeStart = timeStart += delta;
						} else {
							activeCall.timeStart = timeStart += delta * (1 - speed);
						}
					}

					if (options._first === activeCall && options.progress) {
						activeCall._nextProgress = undefined;
						if (lastProgress) {
							lastProgress._nextProgress = lastProgress = activeCall;
						} else {
							firstProgress = lastProgress = activeCall;
						}
					}

					let activeEasing = getValue(activeCall.easing, options.easing, defaults.easing),
						millisecondsEllapsed = activeCall.ellapsedTime = timeCurrent - timeStart,
						duration = getValue(activeCall.duration, options.duration, defaults.duration),
						percentComplete = activeCall.percentComplete = mock ? 1 : Math.min(millisecondsEllapsed / duration, 1),
						tweens = activeCall.tweens;

					if (percentComplete === 1) {
						activeCall._nextComplete = undefined;
						if (lastComplete) {
							lastComplete._nextComplete = lastComplete = activeCall;
						} else {
							firstComplete = lastComplete = activeCall;
						}
					}

					for (let property in tweens) {
						// For every element, iterate through each property.
						let tween = tweens[property],
							easing = tween[Tween.EASING] || activeEasing,
							pattern = tween[Tween.PATTERN],
							rounding = tween[Tween.ROUNDING],
							currentValue = "",
							i = 0;

						for (; i < pattern.length; i++) {
							let startValue = tween[Tween.START][i];

							if (startValue != null) {
								// All easings must deal with numbers except for
								// our internal ones
								let result = easing(activeCall._reverse ? 1 - percentComplete : percentComplete, startValue as number, tween[Tween.END][i] as number, property)

								pattern[i] = rounding && rounding[i] ? Math.round(result) : result;
							}
							currentValue += pattern[i];
						}
						if (property === "tween") {
							// Skip the fake 'tween' property as that is only
							// passed into the progress callback.
							activeCall.tween = currentValue;
						} else {
							// TODO: To solve an IE<=8 positioning bug, the unit type must be dropped when setting a property value of 0 - add normalisations to legacy
							CSS.setPropertyValue(element, property, currentValue);
						}
					}
				}

				// Callbacks and complete that might read the DOM again.

				// Progress callback
				for (activeCall = firstProgress; activeCall; activeCall = nextCall) {
					nextCall = activeCall._nextProgress;
					// Pass to an external fn with a try/catch block for optimisation
					callProgress(activeCall, timeCurrent);
				}
				// Complete animations, including complete callback or looping
				for (activeCall = firstComplete; activeCall; activeCall = nextCall) {
					nextCall = activeCall._nextComplete;
					/* If this call has finished tweening, pass it to complete() to handle call cleanup. */
					completeCall(activeCall);
				}
			}
		}
		if (State.first) {
			State.isTicking = true;
			ticker(tick);
		} else {
			State.isTicking = false;
			lastTick = 0;
		}
		ticking = false;
	}
};
