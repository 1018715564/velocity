namespace VelocityStatic {
	export namespace CSS {

		/************************
		 CSS Property Names
		 ************************/

		export var Names = {
			/* Camelcase a property name into its JavaScript notation (e.g. "background-color" ==> "backgroundColor").
			 Camelcasing is used to normalize property names between and across calls. */
			camelCase: function(property) {
				return property.replace(/-(\w)/g, function(match, subMatch) {
					return subMatch.toUpperCase();
				});
			},
			/* For SVG elements, some properties (namely, dimensional ones) are GET/SET via the element's HTML attributes (instead of via CSS styles). */
			SVGAttribute: function(property) {
				var SVGAttributes = "width|height|x|y|cx|cy|r|rx|ry|x1|x2|y1|y2";

				/* Certain browsers require an SVG transform to be applied as an attribute. (Otherwise, application via CSS is preferable due to 3D support.) */
				if (IE || (State.isAndroid && !State.isChrome)) {
					SVGAttributes += "|transform";
				}

				return new RegExp("^(" + SVGAttributes + ")$", "i").test(property);
			},
			/* Determine whether a property should be set with a vendor prefix. */
			/* If a prefixed version of the property exists, return it. Otherwise, return the original property name.
			 If the property is not at all supported by the browser, return a false flag. */
			prefixCheck: function(property) {
				/* If this property has already been checked, return the cached value. */
				if (State.prefixMatches[property]) {
					return [State.prefixMatches[property], true];
				} else {
					var vendors = ["", "Webkit", "Moz", "ms", "O"];

					for (var i = 0, vendorsLength = vendors.length; i < vendorsLength; i++) {
						var propertyPrefixed;

						if (i === 0) {
							propertyPrefixed = property;
						} else {
							/* Capitalize the first letter of the property to conform to JavaScript vendor prefix notation (e.g. webkitFilter). */
							propertyPrefixed = vendors[i] + property.replace(/^\w/, function(match) {
								return match.toUpperCase();
							});
						}

						/* Check if the browser supports this property as prefixed. */
						var prefixElement = State.prefixElement;

						if (prefixElement && isString(prefixElement.style[propertyPrefixed])) {
							/* Cache the match. */
							State.prefixMatches[property] = propertyPrefixed;

							return [propertyPrefixed, true];
						}
					}

					/* If the browser doesn't support this property in any form, include a false flag so that the caller can decide how to proceed. */
					return [property, false];
				}
			}
		};
	};
};
