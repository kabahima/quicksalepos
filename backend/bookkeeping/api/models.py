import uuid
from django.db import models
from django.contrib.auth.models import User




class Business(models.Model):
    CURRENCY_CHOICES = [
        ("USD", "US Dollar ($)"),
        ("EUR", "Euro (€)"),
        ("GBP", "British Pound (£)"),
        ("UGX", "Ugandan Shilling (UGX)"),
        ("KES", "Kenyan Shilling (KSh)"),
        ("TZS", "Tanzanian Shilling (TSh)"),
        ("RWF", "Rwandan Franc (RWF)"),
        ("NGN", "Nigerian Naira (₦)"),
        ("GHS", "Ghanaian Cedi (₵)"),
        ("ZAR", "South African Rand (R)"),
        ("ETB", "Ethiopian Birr (Br)"),
        ("ZMW", "Zambian Kwacha (ZK)"),
        ("XOF", "West African CFA (CFA)"),
        ("XAF", "Central African CFA (FCFA)"),
        ("MWK", "Malawian Kwacha (MK)"),
        ("BIF", "Burundian Franc (BIF)"),
    ]

    TIMEZONE_CHOICES = [
        ("UTC", "UTC"),
        ("Africa/Kampala", "Africa/Kampala (EAT)"),
        ("Africa/Nairobi", "Africa/Nairobi (EAT)"),
        ("Africa/Dar_es_Salaam", "Africa/Dar es Salaam (EAT)"),
        ("Africa/Kigali", "Africa/Kigali (CAT)"),
        ("Africa/Lagos", "Africa/Lagos (WAT)"),
        ("Africa/Accra", "Africa/Accra (GMT)"),
        ("Africa/Johannesburg", "Africa/Johannesburg (SAST)"),
        ("Africa/Addis_Ababa", "Africa/Addis Ababa (EAT)"),
        ("Africa/Lusaka", "Africa/Lusaka (CAT)"),
        ("Africa/Bujumbura", "Africa/Bujumbura (CAT)"),
        ("Europe/London", "Europe/London (GMT/BST)"),
        ("America/New_York", "America/New York (EST/EDT)"),
    ]

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="businesses")
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    logo = models.ImageField(upload_to="logos/", blank=True, null=True)
    # new settings fields
    currency = models.CharField(max_length=10, choices=CURRENCY_CHOICES, default="UGX")
    currency_symbol = models.CharField(max_length=5, default="UGX ")
    timezone = models.CharField(max_length=60, choices=TIMEZONE_CHOICES, default="UTC")
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0,
                                   help_text="Tax percentage e.g. 16 for 16%")
    low_stock_threshold = models.PositiveIntegerField(default=5,
                                                      help_text="Alert when stock falls below this number")
    receipt_header = models.CharField(max_length=255, blank=True,
                                      help_text="Extra line shown at top of receipt e.g. 'Welcome!'")
    receipt_footer = models.CharField(max_length=255, blank=True,
                                      help_text="Shown at bottom of receipt e.g. 'Thank you!'")
    receipt_show_tax = models.BooleanField(default=False)
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                          help_text="Opening cash balance (float) for end-of-day reconciliation")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Member(models.Model):
    ROLE_CHOICES = [
        ("owner", "Owner"),
        ("manager", "Manager"),
        ("cashier", "Cashier"),
        ("accountant", "Accountant"),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="members")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    stations = models.ManyToManyField("Station", related_name="members", blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "business")

    def __str__(self):
        return f"{self.user.username} - {self.business.name} ({self.role})"


class Station(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="stations")
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="managed_stations")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("name", "business")

    def __str__(self):
        return f"{self.business.name} - {self.name}"


class Customer(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="customers")
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    total_purchases = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    outstanding_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                       help_text="Maximum credit allowed for this customer")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class CustomerPayment(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="payments")
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="customer_payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=[
        ("cash", "Cash"),
        ("mobile_money", "Mobile Money"),
        ("bank", "Bank"),
        ("card", "Card"),
    ])
    reference = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment {self.customer.name} - {self.amount}"


class Supplier(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="suppliers")
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    total_purchases = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_payments = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    outstanding_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Sale(models.Model):
    PAYMENT_METHODS = [
        ("cash", "Cash"),
        ("mobile_money", "Mobile Money"),
        ("bank", "Bank"),
        ("card", "Card"),
        ("credit", "Credit"),
    ]
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="sales")
    station = models.ForeignKey("Station", on_delete=models.SET_NULL, null=True, blank=True, related_name="sales")
    receipt_number = models.CharField(max_length=50, unique=True)
    date = models.DateField()
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="sales")
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            self.receipt_number = "RCP-" + uuid.uuid4().hex[:8].upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Sale {self.receipt_number}"


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    item_name = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=20, default="pcs")
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.item_name} x {self.quantity} {self.unit}"


class ExpenseCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class ProductCategory(models.Model):
    name = models.CharField(max_length=100)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="product_categories")

    class Meta:
        unique_together = ("name", "business")

    def __str__(self):
        return self.name


class Brand(models.Model):
    name = models.CharField(max_length=100)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="brands")
    category = models.ForeignKey(ProductCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="brands")

    class Meta:
        unique_together = ("name", "business")

    def __str__(self):
        return self.name


class Expense(models.Model):
    PAYMENT_METHODS = [
        ("cash", "Cash"),
        ("mobile_money", "Mobile Money"),
        ("bank", "Bank"),
        ("card", "Card"),
    ]
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="expenses")
    date = models.DateField()
    category = models.ForeignKey(ExpenseCategory, on_delete=models.SET_NULL, null=True)
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True)
    attachment = models.FileField(upload_to="expense_attachments/", blank=True, null=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.category} - {self.amount}"


class StockCount(models.Model):
    UNIT_CHOICES = [
        ("pcs", "Pieces"),
        ("kg", "Kilograms"),
        ("g", "Grams"),
        ("packets", "Packets"),
        ("litres", "Litres"),
        ("ml", "Millilitres"),
        ("bags", "Bags"),
        ("boxes", "Boxes"),
        ("bottles", "Bottles"),
        ("bundles", "Bundles"),
        ("dozen", "Dozen"),
        ("meters", "Meters"),
        ("rolls", "Rolls"),
        ("sheets", "Sheets"),
        ("tonnes", "Tonnes"),
        ("sets", "Sets"),
        ("pairs", "Pairs"),
        ("other", "Other"),
    ]
    CATEGORY_CHOICES = [
        ("building_materials", "Building Materials"),
        ("plumbing", "Plumbing"),
        ("electrical", "Electrical"),
        ("tools", "Tools"),
        ("paint", "Paint and Finishes"),
        ("fasteners", "Fasteners"),
        ("roofing", "Roofing"),
        ("timber", "Timber and Boards"),
        ("safety", "Safety Equipment"),
        ("hardware_other", "Other Hardware"),
        ("other", "Other"),
    ]
    BRAND_CHOICES = [
        ("generic", "Generic"),
        ("colgate", "Colgate"),
        ("oral_b", "Oral-B"),
        ("pepsodent", "Pepsodent"),
        ("close_up", "Close-Up"),
        ("nivea", "Nivea"),
        ("dove", "Dove"),
        ("lux", "Lux"),
        ("lifebuoy", "Lifebuoy"),
        ("ariel", "Ariel"),
        ("tide", "Tide"),
        ("omo", "Omo"),
        ("always", "Always"),
        ("whisper", "Whisper"),
        ("pampers", "Pampers"),
        ("huggies", "Huggies"),
        ("nestle", "Nestlé"),
        ("coca_cola", "Coca-Cola"),
        ("pepsi", "Pepsi"),
        ("sprite", "Sprite"),
        ("fanta", "Fanta"),
        ("kinley", "Kinley"),
        ("unilever", "Unilever"),
        ("procter", "Procter & Gamble"),
        ("other", "Other"),
    ]
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="stock_counts")
    date = models.DateField()
    product_name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True, default="other")
    brand = models.CharField(max_length=100, blank=True, default="generic")
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default="pcs")
    sku = models.CharField(max_length=50, blank=True)
    barcode = models.CharField(max_length=100, blank=True)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reorder_level = models.DecimalField(max_digits=10, decimal_places=2, default=5)
    opening_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_added = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quantity_sold = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    expected_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    physical_count = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    difference = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.expected_stock = self.opening_stock + self.stock_added - self.quantity_sold
        self.difference = self.physical_count - self.expected_stock
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product_name} ({self.unit}) - {self.date}"


class CashBook(models.Model):
    TRANSACTION_TYPES = [
        ("sale", "Sale"),
        ("expense", "Expense"),
        ("customer_payment", "Customer Payment"),
        ("supplier_payment", "Supplier Payment"),
        ("other_income", "Other Income"),
        ("withdrawal", "Withdrawal"),
    ]
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="cashbook_entries")
    date = models.DateField()
    transaction_type = models.CharField(max_length=30, choices=TRANSACTION_TYPES)
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference_id = models.IntegerField(null=True, blank=True)
    reference_model = models.CharField(max_length=50, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.transaction_type} - {self.amount}"


class Receipt(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="receipts")
    sale = models.OneToOneField(Sale, on_delete=models.CASCADE, related_name="receipt")
    pdf_file = models.FileField(upload_to="receipts/", blank=True, null=True)
    sent_email = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Receipt {self.sale.receipt_number}"
