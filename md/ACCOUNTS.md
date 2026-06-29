# Kawayan AI - Account Types & Permissions

[**⬅ Back: API Guide**](./API_GUIDE.md) | [**Next: All Tables ➔**](./ALL_TABLES.md)

Kawayan AI uses a role-based access control (RBAC) system to ensure security and efficient management.

The following accounts are pre-seeded in the database for testing and development purposes.

| Role | Business Name | Email | Password | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Kawayan Admin | `admin@kawayan.ph` | `Admin123!` | Full system access. Can view all data and manage users. |
| **Support** | Kawayan Support | `support@kawayan.ph` | `Support123!` | Access to support tickets and user assistance tools. Sign in via **Login** on the home page, or the **Staff Portal** (lock icon on the landing footer). |
| **User** | Kapihan sa Nayon | `cafe@kawayan.ph` | `Password123!` | Sample F&B business (Coffee Shop). |
| **User** | Panaderia de Manila | `bakery@kawayan.ph` | `Password123!` | Sample Bakery business. |
| **User** | Gadget Hub PH | `tech@kawayan.ph` | `Password123!` | Sample Electronics/Retail business. |

> **Note:** All passwords are case-sensitive. In a production environment, passwords are hashed using bcrypt and cannot be retrieved.
