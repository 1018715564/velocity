var QUnit, Velocity, Data, defaultOptions, defaultProperties, defaultStyles, asyncCheckDuration, completeCheckDuration;

QUnit.skip("Reverse", function(assert) {
	var done = assert.async(1),
			testEasing = "spring",
			$target = getTarget();

	assert.expect(5);
	Velocity($target, {opacity: defaultProperties.opacity, width: defaultProperties.width}, {easing: testEasing});
	Velocity($target, "reverse", function() {
//					assert.equal(parseFloat(Velocity.CSS.getPropertyValue($target, "opacity")), defaultStyles.opacity, "Reversed to initial property #1.");
//					assert.equal(parseFloat(Velocity.CSS.getPropertyValue($target, "width")), defaultStyles.width, "Reversed to initial property #2.");
//
//					done();
	});
	/* Check chained reverses. */
	Velocity($target, "reverse", function() {
		assert.equal(parseFloat(Velocity.CSS.getPropertyValue($target, "opacity")), defaultProperties.opacity, "Reversed to reversed property #1.");
		assert.equal(parseFloat(Velocity.CSS.getPropertyValue($target, "width")), defaultProperties.width, "Reversed to reversed property #2.");

		/* Ensure the options were passed through until the end. */
		assert.equal(Data($target).opts.easing, testEasing, "Options object passed through.");

		done();
	});
});
