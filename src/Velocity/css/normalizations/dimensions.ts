///<reference path="normalizations.ts" />
/*
 * VelocityJS.org (C) 2014-2017 Julian Shapiro.
 *
 * Licensed under the MIT license. See LICENSE file in the project root for details.
 */

namespace VelocityStatic.CSS {

	/**
	 * Figure out the dimensions for this width / height based on the
	 * potential borders and whether we care about them.
	 */
	export function augmentDimension(element: HTMLorSVGElement, name: string, wantInner: boolean): number {
		let isBorderBox = getPropertyValue(element, "boxSizing").toString().toLowerCase() === "border-box";

		if (isBorderBox === wantInner) {
			// in box-sizing mode, the CSS width / height accessors already
			// give the outerWidth / outerHeight.
			let i: number,
				value: number,
				augment = 0,
				sides = name === "width" ? ["Left", "Right"] : ["Top", "Bottom"],
				fields = ["padding" + sides[0], "padding" + sides[1], "border" + sides[0] + "Width", "border" + sides[1] + "Width"];

			for (i = 0; i < fields.length; i++) {
				value = parseFloat(getPropertyValue(element, fields[i]) as string);
				if (!isNaN(value)) {
					augment += value;
				}
			}
			return wantInner ? -augment : augment;
		}
		return 0;
	}

	/**
	 * Get/set the inner/outer dimension
	 */
	function getDimension(name, wantInner: boolean) {
		return function(element: HTMLorSVGElement, propertyValue?: string): string | boolean {
			if (propertyValue === undefined) {
				return augmentDimension(element, name, wantInner) + "px";
			}
			setPropertyValue(element, name, (parseFloat(propertyValue) - augmentDimension(element, name, wantInner)) + "px");
			return true;
		} as VelocityNormalizationsFn;
	}

	registerNormalization(["innerWidth", getDimension("width", true)]);
	registerNormalization(["innerHeight", getDimension("height", true)]);
	registerNormalization(["outerWidth", getDimension("width", false)]);
	registerNormalization(["outerHeight", getDimension("height", false)]);
}
