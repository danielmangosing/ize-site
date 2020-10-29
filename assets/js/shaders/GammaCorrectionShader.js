console.warn( "THREE.GammaCorrectionShader: As part of the transition to ES6 Modules, the files in 'examples/js' were deprecated in May 2020 (r117) and will be deleted in December 2020 (r124). You can find more information about developing using ES6 Modules in https://threejs.org/docs/#manual/en/introduction/Installation." );
/**
 * Gamma Correction Shader
 * http://en.wikipedia.org/wiki/gamma_correction
 */

THREE.GammaCorrectionShader = {

	uniforms: {

		"tDiffuse": { value: null },
    "toneMappingExposure": { value: 1.0 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

		"	vUv = uv;",
		"	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform sampler2D tDiffuse;",

    "uniform float toneMappingExposure;",

		"varying vec2 vUv;",

    "vec3 ACESFilmicToneMapping( vec3 color ) {",

      "color *= toneMappingExposure;",
      "return saturate( ( color * ( 2.51 * color + 0.03 ) ) / ( color * ( 2.43 * color + 0.59 ) + 0.14 ) );",

    "}",


		"void main() {",

		"	gl_FragColor = texture2D( tDiffuse, vUv );",

    "gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );",


		"}"

	].join( "\n" )

};
