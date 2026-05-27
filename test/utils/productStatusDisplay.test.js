import {
  flowVolumesLitersFromStatus,
  sumVolumeLiterFields,
} from '../../src/utils/productStatusDisplay.js';

describe('productStatusDisplay', () => {
  it('converts Tuya raw 0.1L totals to display liters', () => {
    const status = [
      { code: 'flowrate_total_1', value: 150 },
      { code: 'flowrate_total_2', value: 80 },
    ];
    expect(flowVolumesLitersFromStatus(status, 'any-device')).toEqual({
      production_liters: 15,
      rejection_liters: 8,
    });
  });

  it('sums expected merge totals in liters', () => {
    expect(
      sumVolumeLiterFields(
        { production_liters: 5, rejection_liters: 5 },
        { production_liters: 10, rejection_liters: 10 }
      )
    ).toEqual({ production_liters: 15, rejection_liters: 15 });
  });
});
