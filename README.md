# Simple Bookkeeping Software

A lightweight bookkeeping application for small businesses, shops, pharmacies, schools, restaurants, service providers, and traders.

## Features

- **Dashboard**: Overview of sales, expenses, cash balance, and recent transactions
- **Sales Recording**: Record sales with multiple payment methods and auto-generated receipts
- **Expenses**: Track expenses by category
- **Stock Taking**: Monitor stock counts and variances
- **Customers**: Manage customer information and balances
- **Suppliers**: Manage supplier information and balances
- **Cash Book**: Track all cash in and out
- **Reports**: Sales, expense, profit, and stock reports
- **Receipts**: Auto-generated receipts for sales
- **Team**: Multi-business support with role-based access
- **Settings**: Business configuration

## Tech Stack

### Backend
- Django 4.2
- Django REST Framework
- PostgreSQL (defaults to SQLite)
- JWT Authentication

### Frontend
- Next.js 16
- TypeScript
- Tailwind CSS
- Recharts
- React Hook Form

## Quick Start

Run both frontend and backend at the same time with a single command:

**Option 1: PowerShell / CMD (Windows)**
```powershell
.\start.ps1
```
or
```cmd
start.bat
```

**Option 2: WSL / Linux / macOS**
```bash
chmod +x start.sh
./start.sh
```

This opens servers on:
- Backend: http://localhost:8000
- Frontend: http://localhost:3000

## Getting Started

### Backend

```bash
cd backend
uv venv
uv pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:3000 and the backend at http://localhost:8000.

## Deploying frontend and backend to Vercel

Deploy this repository as two Vercel projects: one Next.js frontend and one Python serverless Django API.

### Frontend project

1. Create a Vercel project from this repository and set **Root Directory** to `frontend`.
2. Set `NEXT_PUBLIC_API_URL` to the backend Vercel URL, including `/api`, for example `https://your-api.vercel.app/api`.
3. Deploy. The frontend configuration is in `frontend/vercel.json`.

### Backend project

1. Create a second Vercel project from the same repository and set **Root Directory** to `backend/bookkeeping`.
2. Set the backend variables from `backend/.env.example`, including a long `DJANGO_SECRET_KEY`, `DEBUG=False`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS`.
3. Set `DATABASE_URL` to a managed PostgreSQL database. Vercel functions have ephemeral filesystems, so the bundled SQLite database must not be used for production data.
4. Deploy. The Django function configuration is in `backend/bookkeeping/vercel.json`.
5. Run database migrations against the production database before using the API: `python manage.py migrate` from `backend/bookkeeping` with the production environment variables.

For local development, copy `frontend/.env.example` to `frontend/.env.local` and set `NEXT_PUBLIC_API_URL=http://localhost:8000/api`.

### Deploying the Django API

Configure the backend host with the variables in `backend/.env.example`, run migrations with `python manage.py migrate`, and point `NEXT_PUBLIC_API_URL` at that service. Set `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` to the real API and Vercel domains. Use PostgreSQL or another persistent database in production by setting `DATABASE_URL`; the bundled SQLite database is for local development only.

## Default Superuser

- Username: `admin`
- Email: `admin@example.com`
- Password: Set during `createsuperuser` command

## Project Structure

```
hml/
├── backend/
│   ├── bookkeeping/
│   │   ├── api/
│   │   │   ├── admin.py
│   │   │   ├── apps.py
│   │   │   ├── models.py
│   │   │   ├── serializers.py
│   │   │   ├── urls.py
│   │   │   └── views.py
│   │   ├── bookkeeping/
│   │   │   ├── settings.py
│   │   │   ├── urls.py
│   │   │   ├── wsgi.py
│   │   │   └── asgi.py
│   │   ├── manage.py
│   │   └── requirements.txt
│   └── .venv/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/
│   │   │   ├── sales/
│   │   │   ├── expenses/
│   │   │   ├── stock/
│   │   │   ├── customers/
│   │   │   ├── suppliers/
│   │   │   ├── cashbook/
│   │   │   ├── reports/
│   │   │   ├── receipts/
│   │   │   ├── team/
│   │   │   ├── settings/
│   │   │   ├── login/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   └── Sidebar.tsx
│   │   └── lib/
│   │       └── api.ts
│   ├── package.json
│   └── next.config.ts
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/token/` - Login
- `POST /api/auth/token/refresh/` - Refresh token
- `POST /api/auth/register/` - Register

### Business
- `GET /api/businesses/` - List businesses
- `POST /api/businesses/` - Create business
- `GET /api/businesses/{id}/` - Retrieve business
- `PUT /api/businesses/{id}/` - Update business
- `DELETE /api/businesses/{id}/` - Delete business

### Sales
- `GET /api/sales/` - List sales
- `POST /api/sales/` - Create sale (auto-generates receipt)
- `GET /api/sales/{id}/` - Retrieve sale
- `PUT /api/sales/{id}/` - Update sale
- `DELETE /api/sales/{id}/` - Delete sale

### Expenses
- `GET /api/expenses/` - List expenses
- `POST /api/expenses/` - Create expense
- `GET /api/expenses/{id}/` - Retrieve expense
- `PUT /api/expenses/{id}/` - Update expense
- `DELETE /api/expenses/{id}/` - Delete expense

### Stock Counts
- `GET /api/stock-counts/` - List stock counts
- `POST /api/stock-counts/` - Create stock count
- `GET /api/stock-counts/{id}/` - Retrieve stock count
- `PUT /api/stock-counts/{id}/` - Update stock count
- `DELETE /api/stock-counts/{id}/` - Delete stock count

### Customers
- `GET /api/customers/` - List customers
- `POST /api/customers/` - Create customer
- `GET /api/customers/{id}/` - Retrieve customer
- `PUT /api/customers/{id}/` - Update customer
- `DELETE /api/customers/{id}/` - Delete customer

### Suppliers
- `GET /api/suppliers/` - List suppliers
- `POST /api/suppliers/` - Create supplier
- `GET /api/suppliers/{id}/` - Retrieve supplier
- `PUT /api/suppliers/{id}/` - Update supplier
- `DELETE /api/suppliers/{id}/` - Delete supplier

### Cash Book
- `GET /api/cashbook/` - List cash book entries
- `POST /api/cashbook/` - Create cash book entry
- `GET /api/cashbook/{id}/` - Retrieve entry
- `PUT /api/cashbook/{id}/` - Update entry
- `DELETE /api/cashbook/{id}/` - Delete entry

### Reports
- `GET /api/dashboard/` - Dashboard data
- `GET /api/reports/sales/` - Sales report
- `GET /api/reports/expenses/` - Expense report
- `GET /api/reports/profit/` - Profit report
- `GET /api/reports/stock/` - Stock report

## License

MIT
