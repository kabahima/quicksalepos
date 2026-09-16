from rest_framework import serializers
from .models import Business, Member, Customer, Supplier, Sale, SaleItem, ExpenseCategory, Expense, StockCount, CashBook, Receipt, ProductCategory, Brand, Station, CustomerPayment
from django.contrib.auth.models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_active"]


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = "__all__"
        read_only_fields = ["owner"]


class MemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    business = serializers.StringRelatedField(read_only=True)
    role = serializers.ChoiceField(choices=Member.ROLE_CHOICES, required=False, default="cashier")
    stations = serializers.PrimaryKeyRelatedField(many=True, queryset=Station.objects.all(), required=False)
    username = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    pin = serializers.CharField(write_only=True, required=False, min_length=4, max_length=12)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Member
        fields = [
            "id", "user", "user_id", "username", "password", "pin", "first_name", "last_name", "email",
            "business", "role", "stations", "joined_at",
        ]
        read_only_fields = ["business"]

    def update(self, instance, validated_data):
        stations = validated_data.pop("stations", None)
        user_data = {
            key: validated_data.pop(key)
            for key in ("first_name", "last_name", "email")
            if key in validated_data
        }
        username = validated_data.pop("username", None)
        password = validated_data.pop("password", None)
        pin = validated_data.pop("pin", None)
        if username:
            user_data["username"] = username.strip()
        if stations is not None:
            instance.stations.set(stations)
        if user_data:
            for key, value in user_data.items():
                setattr(instance.user, key, value)
            if password or pin:
                instance.user.set_password(password or pin)
            update_fields = list(user_data)
            if password or pin:
                update_fields.append("password")
            instance.user.save(update_fields=update_fields)
        elif password or pin:
            instance.user.set_password(password or pin)
            instance.user.save(update_fields=["password"])
        return super().update(instance, validated_data)

    def validate(self, attrs):
        business_id = self.initial_data.get("business")
        if business_id and attrs.get("stations"):
            invalid = [station.id for station in attrs["stations"] if str(station.business_id) != str(business_id)]
            if invalid:
                raise serializers.ValidationError({"stations": "All stations must belong to the selected business."})
        return attrs

    def create(self, validated_data):
        stations = validated_data.pop("stations", [])
        user_id = validated_data.pop("user_id", None)
        username = validated_data.pop("username", "").strip()
        password = validated_data.pop("password", None)
        pin = validated_data.pop("pin", None)
        user_fields = {
            key: validated_data.pop(key, "")
            for key in ("first_name", "last_name", "email")
        }
        if user_id:
            user = User.objects.get(id=user_id)
        else:
            if not username or not (password or pin):
                raise serializers.ValidationError({"credentials": "Username and either a password or PIN are required."})
            if User.objects.filter(username=username).exists():
                raise serializers.ValidationError({"username": "That username is already in use."})
            user = User.objects.create_user(username=username, password=password or pin, **user_fields)
        member = Member.objects.create(user=user, **validated_data)
        member.stations.set(stations)
        return member


class StationSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(source="manager.username", read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Station
        fields = ["id", "business", "name", "address", "phone", "manager", "manager_name", "is_active", "member_count", "created_at"]
        read_only_fields = ["business"]

    def get_member_count(self, obj):
        return obj.members.count()


class CustomerSerializer(serializers.ModelSerializer):
    available_credit = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = ["id", "business", "name", "phone", "email", "address", "total_purchases", "amount_paid", "outstanding_balance", "credit_limit", "available_credit", "created_at"]
        read_only_fields = ["business"]

    def get_available_credit(self, obj):
        return float(obj.credit_limit or 0) - float(obj.outstanding_balance or 0)


class CustomerPaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta:
        model = CustomerPayment
        fields = ["id", "customer", "customer_name", "business", "amount", "payment_method", "reference", "notes", "created_by", "created_at"]
        read_only_fields = ["business", "created_by"]


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = "__all__"
        read_only_fields = ["business"]


class SaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = ["id", "item_name", "quantity", "unit", "unit_price", "total"]


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True)
    customer = serializers.StringRelatedField(read_only=True)
    customer_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    station_name = serializers.CharField(source="station.name", read_only=True)
    station_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Sale
        fields = [
            "id", "business", "station", "station_id", "station_name",
            "receipt_number", "date", "customer", "customer_id",
            "payment_method", "total_amount", "notes",
            "created_by", "created_at", "items",
        ]
        read_only_fields = ["business", "receipt_number", "created_by"]

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        # customer_id and station_id are handled by perform_create in the view
        validated_data.pop("customer_id", None)
        validated_data.pop("station_id", None)
        sale = Sale.objects.create(**validated_data)
        for item_data in items_data:
            SaleItem.objects.create(sale=sale, **item_data)
        return sale


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = "__all__"


class ExpenseSerializer(serializers.ModelSerializer):
    category = serializers.StringRelatedField(read_only=True)
    supplier = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Expense
        fields = "__all__"
        read_only_fields = ["business", "created_by"]


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ["id", "name", "business"]
        read_only_fields = ["business"]


class BrandSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Brand
        fields = ["id", "name", "business", "category", "category_name"]
        read_only_fields = ["business"]


class StockCountSerializer(serializers.ModelSerializer):
    unit_display = serializers.CharField(source="get_unit_display", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    brand_display = serializers.CharField(source="get_brand_display", read_only=True)

    class Meta:
        model = StockCount
        fields = ["id", "date", "product_name", "category", "category_display", "brand", "brand_display", "unit", "unit_display", "unit_price", "opening_stock", "stock_added", "quantity_sold", "expected_stock", "physical_count", "difference", "notes"]
        read_only_fields = ["business", "expected_stock", "difference", "created_by"]


class CashBookSerializer(serializers.ModelSerializer):
    sale_details = serializers.SerializerMethodField()

    class Meta:
        model = CashBook
        fields = "__all__"
        read_only_fields = ["business", "created_by"]

    def get_sale_details(self, obj):
        if obj.transaction_type != "sale" or not obj.reference_id:
            return None

        sale = (
            Sale.objects.select_related("created_by", "customer")
            .prefetch_related("items")
            .filter(id=obj.reference_id)
            .first()
        )
        if not sale:
            return None

        return {
            "receipt_number": sale.receipt_number,
            "seller": sale.created_by.username if sale.created_by else None,
            "customer": sale.customer.name if sale.customer else None,
            "payment_method": sale.payment_method,
            "total_amount": str(sale.total_amount),
            "sold_at": sale.created_at.isoformat(),
            "notes": sale.notes,
            "items": [
                {
                    "item_name": item.item_name,
                    "quantity": str(item.quantity),
                    "unit": item.unit,
                    "unit_price": str(item.unit_price),
                    "total": str(item.total),
                }
                for item in sale.items.all()
            ],
        }


class ReceiptSerializer(serializers.ModelSerializer):
    sale = serializers.SerializerMethodField()

    class Meta:
        model = Receipt
        fields = "__all__"
        read_only_fields = ["business", "sale"]

    def get_sale(self, obj):
        return {
            "receipt_number": obj.sale.receipt_number,
            "date": obj.sale.date.isoformat() if obj.sale.date else None,
            "total_amount": str(obj.sale.total_amount),
            "created_at": obj.sale.created_at.isoformat() if obj.sale.created_at else None,
            "items": [
                {
                    "item_name": item.item_name,
                    "quantity": str(item.quantity),
                    "unit": item.unit,
                    "unit_price": str(item.unit_price),
                    "total": str(item.total),
                }
                for item in obj.sale.items.all()
            ],
        }


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "first_name", "last_name"]

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user
