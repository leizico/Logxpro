const { z } = require('zod');

const loginSchema = z.object({
  id: z.string().min(1, 'ID é obrigatório'),
  password: z.string().min(1, 'Senha é obrigatória'),
  role: z.enum(['DRIVER', 'MANAGER']).optional()
});

const driverSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  vehiclePlate: z.string().min(7, 'Placa deve ter pelo menos 7 caracteres'), // Validar formato se possível
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional(),
  role: z.enum(['DRIVER', 'MANAGER']).optional()
});

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  weight: z.number().nonnegative(),
  priority: z.string().optional(),
  status: z.string().optional(),
  unitPrice: z.number().nonnegative().optional(),
  totalPrice: z.number().nonnegative().optional()
});

const addressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  city: z.string().optional(),
  state: z.string().length(2).optional(),
  zip: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  neighborhood: z.string().optional()
});

const taskSchema = z.object({
  nfeKey: z.string().optional(),
  nfeNumber: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  customerName: z.string().min(1, 'Nome do cliente é obrigatório'),
  address: addressSchema.optional(),
  items: z.array(itemSchema).min(1, 'Pelo menos um item é necessário'),
  scheduledTime: z.string().optional(), // Pode validar como data
  priority: z.string().optional(),
  driverId: z.string().optional().nullable(),
  totalValue: z.number().nonnegative().optional(),
  loadNumber: z.string().optional(),
  expeditionStatus: z.string().optional()
});

const registerSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  role: z.enum(['DRIVER', 'MANAGER']),
  vehiclePlate: z.string().optional()
});

module.exports = {
  loginSchema,
  driverSchema,
  taskSchema,
  registerSchema
};
