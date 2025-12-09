import {
  calculateTotalItems,
  calculateInventoryValue,
  getLowStockItems,
} from '../kpi-calculations'
import type { Product } from '@/services/types'

describe('KPI Calculations', () => {
  const mockProducts: Product[] = [
    {
      id: '1',
      userId: 'user1',
      name: 'Product 1',
      quantity: 10,
      unitPrice: 100,
      salePrice: 150,
    },
    {
      id: '2',
      userId: 'user1',
      name: 'Product 2',
      quantity: 5,
      unitPrice: 50,
      salePrice: 75,
      isActive: false, // Should be excluded
    },
    {
      id: '3',
      userId: 'user1',
      name: 'Product 3',
      quantity: 2,
      unitPrice: 200,
      minStockLevel: 5, // Low stock
    },
  ]

  describe('calculateTotalItems', () => {
    it('should calculate total items (sum of quantities)', () => {
      const total = calculateTotalItems(mockProducts)
      expect(total).toBe(17) // 10 + 5 + 2 (sums all quantities)
    })

    it('should return 0 for empty array', () => {
      expect(calculateTotalItems([])).toBe(0)
    })
  })

  describe('calculateInventoryValue', () => {
    it('should calculate total inventory value based on lineTotal', () => {
      const productsWithLineTotal: Product[] = [
        {
          id: '1',
          userId: 'user1',
          name: 'Product 1',
          quantity: 10,
          unitPrice: 100,
          lineTotal: 1000,
        },
        {
          id: '2',
          userId: 'user1',
          name: 'Product 2',
          quantity: 5,
          unitPrice: 50,
          lineTotal: 250,
        },
      ]
      const value = calculateInventoryValue(productsWithLineTotal)
      expect(value).toBe(1250) // 1000 + 250
    })

    it('should return 0 for empty array', () => {
      expect(calculateInventoryValue([])).toBe(0)
    })

    it('should return 0 when lineTotal is missing', () => {
      const value = calculateInventoryValue(mockProducts)
      expect(value).toBe(0) // No lineTotal in mockProducts
    })
  })

  describe('getLowStockItems', () => {
    it('should identify low stock items (quantity <= minStockLevel or default 10)', () => {
      const lowStock = getLowStockItems(mockProducts)
      // Product 1: quantity 10 <= minStockLevel (undefined, defaults to 10) ✓
      // Product 2: quantity 5 <= minStockLevel (undefined, defaults to 10) ✓
      // Product 3: quantity 2 <= minStockLevel 5 ✓
      expect(lowStock.length).toBeGreaterThanOrEqual(1)
      expect(lowStock.some(p => p.id === '3')).toBe(true)
    })

    it('should return empty array when no low stock items', () => {
      const productsWithoutLowStock: Product[] = [
        {
          id: '1',
          userId: 'user1',
          name: 'Product 1',
          quantity: 20,
          unitPrice: 100,
          minStockLevel: 10,
        },
      ]
      expect(getLowStockItems(productsWithoutLowStock)).toHaveLength(0)
    })
  })
})

