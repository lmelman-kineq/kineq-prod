import { describe, it, expect } from 'vitest'
import { ELIGIBLE_ALERT_FIELDS, isEligibleAlertField } from './eligibleAlertFields'

describe('ELIGIBLE_ALERT_FIELDS', () => {
  it('cada entrada tiene label y outerTab, y section cuando outerTab es "ficha"', () => {
    for (const [campo, meta] of Object.entries(ELIGIBLE_ALERT_FIELDS)) {
      expect(meta.label, `${campo}.label`).toBeTruthy()
      expect(['ficha', 'estudios'], `${campo}.outerTab`).toContain(meta.outerTab)
      if (meta.outerTab === 'ficha') {
        expect(meta.section, `${campo}.section`).toBeTruthy()
      }
    }
  })

  it('estudiosComplementarios vive en la tab "estudios", no dentro de Ficha Inicial', () => {
    expect(ELIGIBLE_ALERT_FIELDS.estudiosComplementarios.outerTab).toBe('estudios')
    expect(ELIGIBLE_ALERT_FIELDS.estudiosComplementarios.section).toBeUndefined()
  })
})

describe('isEligibleAlertField', () => {
  it('campos administrativos (no clínicos) no son elegibles', () => {
    expect(isEligibleAlertField('email')).toBe(false)
    expect(isEligibleAlertField('direccion')).toBe(false)
    expect(isEligibleAlertField('fechaNacimiento')).toBe(false)
  })

  it('campos elegibles reales devuelven true', () => {
    expect(isEligibleAlertField('motivoConsulta')).toBe(true)
    expect(isEligibleAlertField('dolorSintomas')).toBe(true)
  })
})
