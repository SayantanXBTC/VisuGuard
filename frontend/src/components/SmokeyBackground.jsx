import { useEffect, useRef, useState } from 'react';

// An animated, mouse-reactive "smoke" background drawn with a WebGL fragment shader.
// One full-screen quad is drawn every frame; all the work is done by the shader on the GPU.

const VERTEX_SHADER = `
  attribute vec4 a_position;
  void main() {
    gl_Position = a_position;
  }
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;
uniform vec3 u_color;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 centeredUV = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
  float time = iTime * 0.5;

  // Mouse position, 0..1, remapped to -1..1
  vec2 mouse = iMouse / iResolution;
  vec2 rippleCenter = 2.0 * mouse - 1.0;

  // Wavy distortion: this is what makes the smoke shape
  vec2 distortion = centeredUV;
  for (float i = 1.0; i < 8.0; i++) {
    distortion.x += 0.5 / i * cos(i * 2.0 * distortion.y + time + rippleCenter.x * 3.1415);
    distortion.y += 0.5 / i * cos(i * 2.0 * distortion.x + time + rippleCenter.y * 3.1415);
  }

  float wave = abs(sin(distortion.x + distortion.y + time));
  float glow = smoothstep(0.9, 0.2, wave);
  fragColor = vec4(u_color * glow, 1.0);
}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

function hexToRgb(hex) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Sets up WebGL and returns { draw(time, mouseX, mouseY), destroy() }, or null when WebGL is not available.
function createSmoke(canvas, color) {
  const gl = canvas.getContext('webgl');
  if (!gl) return null;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertexShader || !fragmentShader || !program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Shader link error:', gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  // Two triangles that cover the whole canvas
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const resolutionUniform = gl.getUniformLocation(program, 'iResolution');
  const timeUniform = gl.getUniformLocation(program, 'iTime');
  const mouseUniform = gl.getUniformLocation(program, 'iMouse');
  gl.uniform3f(gl.getUniformLocation(program, 'u_color'), ...hexToRgb(color));

  return {
    draw(time, mouseX, mouseY) {
      // Keep the drawing buffer as big as the element (times the screen density, capped to keep it fast)
      const density = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(canvas.clientWidth * density));
      const height = Math.max(1, Math.round(canvas.clientHeight * density));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform2f(resolutionUniform, width, height);
      gl.uniform1f(timeUniform, time);
      // The mouse is given in CSS pixels from the top left; the shader wants pixels from the bottom left
      gl.uniform2f(mouseUniform, mouseX * density, (canvas.clientHeight - mouseY) * density);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    destroy() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    },
  };
}

// The shader background. Put it inside a positioned element; it fills it.
// If WebGL is missing, a plain gradient is shown instead. With "reduce motion" on, one still frame is drawn.
function SmokeyBackground({ color = '#a8452f', className = '' }) {
  const canvasRef = useRef(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const smoke = createSmoke(canvas, color);
    if (!smoke) {
      setSupported(false);
      return undefined;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    const mouse = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }; // starts in the middle
    let frame = 0;

    const render = () => {
      smoke.draw(reduceMotion ? 20 : (performance.now() - start) / 1000 + 20, mouse.x, mouse.y);
      if (!reduceMotion) frame = requestAnimationFrame(render);
    };

    // The card sits on top of the canvas, so the mouse is read from the whole window
    const handleMove = (event) => {
      const box = canvas.getBoundingClientRect();
      mouse.x = event.clientX - box.left;
      mouse.y = event.clientY - box.top;
    };

    window.addEventListener('pointermove', handleMove);
    render();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', handleMove);
      smoke.destroy();
    };
  }, [color]);

  return (
    <div className={`smokey ${supported ? '' : 'smokey-fallback'} ${className}`} aria-hidden="true">
      {supported && <canvas ref={canvasRef} className="smokey-canvas" />}
      <div className="smokey-blur" />
    </div>
  );
}

export default SmokeyBackground;
