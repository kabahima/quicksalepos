from django.contrib import admin
from .models import Business, Member, Customer, Supplier, Sale, SaleItem, ExpenseCategory, Expense, StockCount, CashBook, Receipt


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "phone", "created_at")
    search_fields = ("name", "owner__username")


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ("user", "business", "role")
    list_filter = ("role", "business")


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "phone", "outstanding_balance")
    search_fields = ("name", "phone")


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "phone", "outstanding_balance")
    search_fields = ("name", "phone")


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("receipt_number", "business", "date", "total_amount", "payment_method")
    list_filter = ("date", "payment_method", "business")
    search_fields = ("receipt_number",)


@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display = ("sale", "item_name", "quantity", "unit_price", "total")


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("business", "date", "category", "amount", "payment_method")
    list_filter = ("date", "category", "payment_method")


@admin.register(StockCount)
class StockCountAdmin(admin.ModelAdmin):
    list_display = ("business", "date", "product_name", "expected_stock", "physical_count", "difference")
    list_filter = ("date", "business")
    search_fields = ("product_name",)


@admin.register(CashBook)
class CashBookAdmin(admin.ModelAdmin):
    list_display = ("business", "date", "transaction_type", "amount")
    list_filter = ("date", "transaction_type")


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("sale", "business", "sent_email", "created_at")
