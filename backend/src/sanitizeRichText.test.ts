import { describe, it, expect } from 'vitest'
import { sanitizeRichText, stripToPlainText } from './sanitizeRichText'

describe('sanitizeRichText', () => {
  it('conserva negrita, cursiva y subrayado', () => {
    expect(sanitizeRichText('<b>negrita</b> <i>cursiva</i> <u>subrayado</u>')).toBe('<b>negrita</b> <i>cursiva</i> <u>subrayado</u>')
    expect(sanitizeRichText('<strong>fuerte</strong> <em>énfasis</em>')).toBe('<strong>fuerte</strong> <em>énfasis</em>')
  })

  it('conserva párrafos y saltos de línea', () => {
    expect(sanitizeRichText('<p>uno</p><p>dos</p>')).toBe('<p>uno</p><p>dos</p>')
    expect(sanitizeRichText('uno<br>dos')).toBe('uno<br />dos')
  })

  it('descarta <script> por completo (tag y contenido)', () => {
    expect(sanitizeRichText('<script>alert(1)</script>hola')).toBe('hola')
  })

  it('descarta tags no permitidos pero conserva el texto (ej. <div>, <span>)', () => {
    expect(sanitizeRichText('<div>hola</div>')).toBe('hola')
    expect(sanitizeRichText('<span onclick="alert(1)">hola</span>')).toBe('hola')
  })

  it('descarta atributos de eventos y estilos inline', () => {
    expect(sanitizeRichText('<b onmouseover="alert(1)" style="color:red">hola</b>')).toBe('<b>hola</b>')
  })

  it('descarta links e iframes', () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">click</a>')).toBe('click')
    expect(sanitizeRichText('<iframe src="evil.com"></iframe>texto')).toBe('texto')
  })

  it('texto plano sin tags queda igual', () => {
    expect(sanitizeRichText('dolor < 3/10, sin irradiación')).toBe('dolor &lt; 3/10, sin irradiación')
  })
})

describe('stripToPlainText', () => {
  it('quita todos los tags y deja solo el texto', () => {
    expect(stripToPlainText('<p><b>Hola</b> mundo</p>')).toBe('Hola mundo')
  })

  it('quita contenido de <script> también', () => {
    expect(stripToPlainText('<script>alert(1)</script>hola')).toBe('hola')
  })

  it('recorta espacios sobrantes', () => {
    expect(stripToPlainText('  <p>hola</p>  ')).toBe('hola')
  })
})
