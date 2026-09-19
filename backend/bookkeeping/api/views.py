from django.db import IntegrityError
from rest_framework import generics, views, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncWeek
from django.core.mail import send_mail
from django.conf import settings as dj_settings
from django_filters.rest_framework import DjangoFilterBackend
from datetime import datetime, timedelta, date as date_type
from decimal import Decimal
import uuid

from .models import (
    Business, Member, Customer, Supplier, Sale, SaleItem,
    ExpenseCategory, Expense, StockCount, CashBook, Receipt,
    ProductCategory, Brand, Station, CustomerPayment,
)
from .serializers import (
    RegisterSerializer, BusinessSerializer, MemberSerializer, CustomerSerializer,
    SupplierSerializer, SaleSerializer, ExpenseCategorySerializer, ExpenseSerializer,
    StockCountSerializer, CashBookSerializer, ReceiptSerializer,
    ProductCategorySerializer, BrandSerializer, StationSerializer, CustomerPaymentSerializer,
)


# ─── helpers ──────────────────────────────────────────────────────────────────

def get_accessible_businesses(user):
    """All business IDs this user can access (owner or member)."""
    owned = list(Business.objects.filter(owner=user).values_list("id", flat=True))
    membered = list(Member.objects.filter(user=user).values_list("business_id", flat=True))
    return list(set(owned + membered))


def get_user_role(user, business_id):
    """Return role string for user in business, or 'owner' if they own it."""
    try:
        if Business.objects.filter(id=business_id, owner=user).exists():
            return "owner"
        return Member.objects.get(user=user, business_id=business_id).role
    except (Member.DoesNotExist, ValueError, TypeError):
        return None


def has_role(user, business_id, allowed_roles):
    role = get_user_role(user, business_id)
    return role in allowed_roles


def generate_receipt_number():
    return "RCP-" + uuid.uuid4().hex[:8].upper()


# ─── auth ──────────────────────────────────────────────────────────────────────

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = []


class CurrentUserView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        members = Member.objects.filter(user=user).select_related("business")
        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "members": MemberSerializer(members, many=True).data,
        })


# ─── business ─────────────────────────────────────────────────────────────────

class BusinessListCreateView(generics.ListCreateAPIView):
    serializer_class = BusinessSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Business.objects.filter(id__in=biz_ids)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class BusinessDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BusinessSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only owners can edit/delete their business
        return Business.objects.filter(owner=self.request.user)


# ─── members ──────────────────────────────────────────────────────────────────

class MemberListCreateView(generics.ListCreateAPIView):
    serializer_class = MemberSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["business"]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Member.objects.filter(business_id__in=biz_ids).select_related("user", "business").prefetch_related("stations")

    def perform_create(self, serializer):
        business_id = self.request.data.get("business")
        if not business_id or not str(business_id).isdigit():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"business": "A valid business ID is required."})
        if not has_role(self.request.user, int(business_id), ["owner", "manager"]):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only owners and managers can add members.")
        role = self.request.data.get("role") or "cashier"
        if role == "owner" and get_user_role(self.request.user, int(business_id)) != "owner":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only the business owner can assign the owner role.")
        serializer.save(business_id=int(business_id))


class MemberDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MemberSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Member.objects.filter(business_id__in=biz_ids).select_related("user", "business").prefetch_related("stations")

    def check_manager_access(self, instance):
        if not has_role(self.request.user, instance.business_id, ["owner", "manager"]):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only owners and managers can manage team members.")
        if instance.role == "owner" and get_user_role(self.request.user, instance.business_id) != "owner":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only the business owner can manage the owner account.")

    def perform_update(self, serializer):
        self.check_manager_access(serializer.instance)
        if serializer.validated_data.get("role") == "owner" and get_user_role(self.request.user, serializer.instance.business_id) != "owner":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only the business owner can assign the owner role.")
        serializer.save()

    def perform_destroy(self, instance):
        self.check_manager_access(instance)
        instance.delete()


# ─── stations ────────────────────────────────────────────────────────────────

class StationListCreateView(generics.ListCreateAPIView):
    serializer_class = StationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["business"]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Station.objects.filter(business_id__in=biz_ids).select_related("manager").order_by("name")

    def perform_create(self, serializer):
        business_id = self.request.data.get("business")
        if not business_id or not str(business_id).isdigit():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"business": "A valid business ID is required."})
        if not has_role(self.request.user, int(business_id), ["owner", "manager"]):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only owners and managers can add stations.")
        serializer.save(business_id=int(business_id))


class StationDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = StationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Station.objects.filter(business_id__in=biz_ids).select_related("manager")

    def perform_update(self, serializer):
        business_id = serializer.instance.business_id
        if not has_role(self.request.user, business_id, ["owner", "manager"]):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only owners and managers can edit stations.")
        serializer.save()

    def perform_destroy(self, instance):
        business_id = instance.business_id
        if not has_role(self.request.user, business_id, ["owner", "manager"]):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only owners and managers can delete stations.")
        instance.delete()


# ─── customers ────────────────────────────────────────────────────────────────

class CustomerListCreateView(generics.ListCreateAPIView):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["business"]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Customer.objects.filter(business_id__in=biz_ids)

    def perform_create(self, serializer):
        business_id = self.request.data.get("business")
        if not business_id or not str(business_id).isdigit():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"business": "A valid business ID is required."})
        if not has_role(self.request.user, int(business_id), ["owner", "manager", "accountant"]):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Insufficient permissions.")
        serializer.save(business_id=int(business_id))


class CustomerDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Customer.objects.filter(business_id__in=biz_ids)


# ─── customer payments ───────────────────────────────────────────────────────

class CustomerPaymentListCreateView(generics.ListCreateAPIView):
    serializer_class = CustomerPaymentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["business", "customer"]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return CustomerPayment.objects.filter(business_id__in=biz_ids).select_related("customer", "created_by").order_by("-created_at")

    def perform_create(self, serializer):
        business_id = self.request.data.get("business")
        if not business_id or not str(business_id).isdigit():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"business": "A valid business ID is required."})
        if not has_role(self.request.user, int(business_id), ["owner", "manager", "accountant"]):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Insufficient permissions.")
        payment = serializer.save(business_id=int(business_id), created_by=self.request.user)

        # Update customer totals
        customer = payment.customer
        customer.amount_paid = (customer.amount_paid or 0) + payment.amount
        customer.outstanding_balance = (customer.outstanding_balance or 0) - payment.amount
        if customer.outstanding_balance < 0:
            customer.outstanding_balance = 0
        customer.save()

        # Auto CashBook entry
        CashBook.objects.create(
            business=customer.business,
            date=payment.created_at.date(),
            transaction_type="customer_payment",
            description=f"Credit payment from {customer.name}",
            amount=payment.amount,
            reference_id=payment.id,
            reference_model="CustomerPayment",
            created_by=self.request.user,
        )


class CustomerPaymentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CustomerPaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return CustomerPayment.objects.filter(business_id__in=biz_ids).select_related("customer", "created_by")

    def perform_destroy(self, instance):
        customer = instance.customer
        customer.amount_paid = (customer.amount_paid or 0) - instance.amount
        customer.outstanding_balance = (customer.outstanding_balance or 0) + instance.amount
        customer.save()
        instance.delete()


# ─── suppliers ────────────────────────────────────────────────────────────────

class SupplierListCreateView(generics.ListCreateAPIView):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["business"]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Supplier.objects.filter(business_id__in=biz_ids)

    def perform_create(self, serializer):
        business_id = self.request.data.get("business")
        if not business_id or not str(business_id).isdigit():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"business": "A valid business ID is required."})
        if not has_role(self.request.user, int(business_id), ["owner", "manager", "accountant"]):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Insufficient permissions.")
        serializer.save(business_id=int(business_id))


class SupplierDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Supplier.objects.filter(business_id__in=biz_ids)


# ─── sales ────────────────────────────────────────────────────────────────────

class SaleListCreateView(generics.ListCreateAPIView):
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["business", "date", "payment_method", "customer"]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Sale.objects.filter(business_id__in=biz_ids).order_by("-date", "-created_at", "-id")

    def perform_create(self, serializer):
        business_id = self.request.data.get("business")
        if not business_id or not str(business_id).isdigit():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"business": "A valid business ID is required."})
        # All roles (including cashier) can create sales
        if not has_role(self.request.user, int(business_id), ["owner", "manager", "cashier", "accountant"]):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have access to this business.")

        station_id = self.request.data.get("station")
        customer_id = self.request.data.get("customer")
        payment_method = self.request.data.get("payment_method", "cash")
        sale = serializer.save(
            business_id=int(business_id),
            created_by=self.request.user,
            station_id=station_id,
            customer_id=customer_id,
        )

        # ── Auto-create receipt ──
        Receipt.objects.get_or_create(sale=sale, defaults={"business": sale.business})

        # ── Auto CashBook entry for this sale ──
        CashBook.objects.create(
            business=sale.business,
            date=sale.date,
            transaction_type="sale",
            description=f"Sale {sale.receipt_number}",
            amount=sale.total_amount,
            reference_id=sale.id,
            reference_model="Sale",
            created_by=self.request.user,
        )

        # ── Update StockCount.quantity_sold for each item sold today ──
        today = sale.date
        for item in sale.items.all():
            stock_entry = StockCount.objects.filter(
                business=sale.business,
                product_name__iexact=item.item_name,
                date=today,
            ).first()
            if stock_entry:
                stock_entry.quantity_sold = (stock_entry.quantity_sold or 0) + item.quantity
                stock_entry.save()  # triggers expected_stock & difference recalculation

        # ── Update customer balance for credit sales ──
        if customer_id and payment_method == "credit":
            customer = Customer.objects.filter(id=customer_id, business_id=business_id).first()
            if customer:
                customer.outstanding_balance = (customer.outstanding_balance or 0) + sale.total_amount
                customer.total_purchases = (customer.total_purchases or 0) + sale.total_amount
                customer.save()


class SaleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Sale.objects.filter(business_id__in=biz_ids)


# ─── expense categories ───────────────────────────────────────────────────────

class ExpenseCategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ExpenseCategory.objects.all().order_by("name")


# ─── product categories ───────────────────────────────────────────────────────

class ProductCategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["business"]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return ProductCategory.objects.filter(business_id__in=biz_ids).order_by("name")

    def perform_create(self, serializer):
        business_id = self.request.data.get("business")
        if not business_id:
            biz_ids = get_accessible_businesses(self.request.user)
            if biz_ids:
                business_id = biz_ids[0]
        try:
            serializer.save(business_id=business_id)
        except IntegrityError:
            name = serializer.validated_data.get("name", "")
            existing = ProductCategory.objects.filter(
                name=name, business_id=business_id
            ).first()
            if existing:
                serializer.instance = existing


class ProductCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return ProductCategory.objects.filter(business_id__in=biz_ids)


# ─── brands ───────────────────────────────────────────────────────────────────

class BrandListCreateView(generics.ListCreateAPIView):
    serializer_class = BrandSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["business", "category"]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Brand.objects.filter(business_id__in=biz_ids).select_related("category").order_by("name")

    def perform_create(self, serializer):
        business_id = self.request.data.get("business")
        if not business_id:
            biz_ids = get_accessible_businesses(self.request.user)
            if biz_ids:
                business_id = biz_ids[0]
        try:
            serializer.save(business_id=business_id)
        except IntegrityError:
            name = serializer.validated_data.get("name", "")
            existing = Brand.objects.filter(
                name=name, business_id=business_id
            ).first()
            if existing:
                serializer.instance = existing


class BrandDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BrandSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Brand.objects.filter(business_id__in=biz_ids).select_related("category")


# ─── expenses ─────────────────────────────────────────────────────────────────

class ExpenseListCreateView(generics.ListCreateAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["business", "date", "category"]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Expense.objects.filter(business_id__in=biz_ids).order_by("-date", "-id")

    def perform_create(self, serializer):
        business_id = self.request.data.get("business")
        if not business_id or not str(business_id).isdigit():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"business": "A valid business ID is required."})
        if not has_role(self.request.user, int(business_id), ["owner", "manager", "accountant"]):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Insufficient permissions.")
        expense = serializer.save(business_id=int(business_id), created_by=self.request.user)

        # ── Auto CashBook entry ──
        CashBook.objects.create(
            business=expense.business,
            date=expense.date,
            transaction_type="expense",
            description=expense.description,
            amount=expense.amount,
            reference_id=expense.id,
            reference_model="Expense",
            created_by=self.request.user,
        )


class ExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Expense.objects.filter(business_id__in=biz_ids)


# ─── stock counts ─────────────────────────────────────────────────────────────

class StockCountListCreateView(generics.ListCreateAPIView):
    serializer_class = StockCountSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["business", "date"]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return StockCount.objects.filter(business_id__in=biz_ids).order_by("-date", "-id")

    def perform_create(self, serializer):
        business_id = self.request.data.get("business")
        if not business_id or not str(business_id).isdigit():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"business": "A valid business ID is required."})
        if not has_role(self.request.user, int(business_id), ["owner", "manager", "accountant"]):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Insufficient permissions.")
        serializer.save(business_id=int(business_id), created_by=self.request.user)


class StockCountDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = StockCountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return StockCount.objects.filter(business_id__in=biz_ids)


# ─── daily stock rollover ─────────────────────────────────────────────────────

class StockRolloverView(views.APIView):
    """
    Called by the POS on startup. For each product that has a StockCount
    entry before today but NOT one for today, creates today's entry using
    yesterday's closing physical_count as opening_stock.
    Returns the list of today's stock entries.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        business_id = request.data.get("business")
        if not business_id or not str(business_id).isdigit():
            return Response({"error": "A valid business ID is required."}, status=400)

        if not has_role(request.user, int(business_id), ["owner", "manager", "cashier", "accountant"]):
            return Response({"error": "Access denied"}, status=403)

        today = datetime.now().date()

        # Find all products that have stock history but no entry for today
        existing_today = set(
            StockCount.objects.filter(business_id=business_id, date=today)
            .values_list("product_name", flat=True)
        )

        # Get the latest entry per product (before today)
        from django.db.models import Max
        latest_dates = (
            StockCount.objects
            .filter(business_id=business_id, date__lt=today)
            .values("product_name")
            .annotate(latest=Max("date"))
        )

        created = 0
        for row in latest_dates:
            product_name = row["product_name"]
            if product_name in existing_today:
                continue  # already has today's entry

            prev = StockCount.objects.filter(
                business_id=business_id,
                product_name=product_name,
                date=row["latest"],
            ).first()

            if prev:
                # Today's opening = yesterday's physical count
                StockCount.objects.create(
                    business_id=business_id,
                    date=today,
                    product_name=product_name,
                    opening_stock=prev.physical_count,
                    stock_added=0,
                    quantity_sold=0,
                    physical_count=prev.physical_count,  # assume unchanged until counted
                    notes="Auto-rolled from previous day",
                    created_by=request.user,
                )
                created += 1

        today_entries = StockCount.objects.filter(business_id=business_id, date=today)
        return Response({
            "rolled_over": created,
            "today": StockCountSerializer(today_entries, many=True).data,
        })


# ─── cashbook ─────────────────────────────────────────────────────────────────

class CashBookListCreateView(generics.ListCreateAPIView):
    serializer_class = CashBookSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["business", "date", "transaction_type"]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return CashBook.objects.filter(business_id__in=biz_ids).order_by("-date", "-created_at", "-id")

    def perform_create(self, serializer):
        business_id = self.request.data.get("business")
        if not business_id or not str(business_id).isdigit():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"business": "A valid business ID is required."})
        if not has_role(self.request.user, int(business_id), ["owner", "manager", "accountant"]):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Insufficient permissions.")
        serializer.save(business_id=int(business_id), created_by=self.request.user)


class CashBookDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CashBookSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return CashBook.objects.filter(business_id__in=biz_ids)


# ─── receipts ─────────────────────────────────────────────────────────────────

class ReceiptListCreateView(generics.ListCreateAPIView):
    serializer_class = ReceiptSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Receipt.objects.filter(business_id__in=biz_ids).order_by("-created_at")


class ReceiptDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ReceiptSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        biz_ids = get_accessible_businesses(self.request.user)
        return Receipt.objects.filter(business_id__in=biz_ids)


class SendReceiptEmailView(views.APIView):
    """POST /receipts/send_email/ — send a receipt as an HTML email."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        receipt_number = request.data.get("receipt_number")
        email = request.data.get("email")

        if not receipt_number or not email:
            return Response(
                {"error": "receipt_number and email are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        biz_ids = get_accessible_businesses(request.user)
        try:
            receipt = Receipt.objects.select_related("sale", "business").get(
                sale__receipt_number=receipt_number,
                business_id__in=biz_ids,
            )
        except Receipt.DoesNotExist:
            return Response(
                {"error": "Receipt not found"}, status=status.HTTP_404_NOT_FOUND
            )

        sale = receipt.sale
        business = receipt.business
        symbol = business.currency_symbol or "$"

        items_rows = ""
        for item in sale.items.all():
            items_rows += (
                f"<tr>"
                f"<td>{item.item_name}</td>"
                f"<td>{item.quantity} {item.unit}</td>"
                f"<td>{symbol}{float(item.unit_price):.2f}</td>"
                f"<td>{symbol}{float(item.total):.2f}</td>"
                f"</tr>"
            )

        payment_label = dict(Sale.PAYMENT_METHODS).get(
            sale.payment_method, sale.payment_method
        )

        html = f"""<html><body style="font-family:Arial,sans-serif;font-size:14px;color:#333">
<h2 style="color:#f53f64;margin-bottom:4px">{business.name}</h2>
<h3 style="margin-top:0">Receipt #{sale.receipt_number}</h3>
<p><strong>Date:</strong> {sale.date}</p>
<p><strong>Payment Method:</strong> {payment_label}</p>
<p><strong>Customer:</strong> {sale.customer.name if sale.customer else "Walk-in"}</p>
<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;margin:20px 0">
<tr style="background:#f9f9f9"><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
{items_rows}
<tr><td colspan="3" style="font-weight:bold">TOTAL</td><td style="font-weight:bold">{symbol}{float(sale.total_amount):.2f}</td></tr>
</table>
<p style="color:#999;margin-top:20px;font-size:12px">Thank you for your purchase!</p>
<p style="color:#ccc;font-size:11px">Powered by Quick Sale</p>
</body></html>"""

        plain = (
            f"{business.name}\nReceipt #{sale.receipt_number}\n"
            f"Date: {sale.date}\nPayment: {payment_label}\n\n"
            f"Total: {symbol}{float(sale.total_amount):.2f}\n\n"
            f"Thank you for your purchase!\nPowered by Quick Sale"
        )

        try:
            send_mail(
                subject=f"Receipt #{sale.receipt_number} from {business.name}",
                message=plain,
                from_email=dj_settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                html_message=html,
                fail_silently=False,
            )
            receipt.sent_email = True
            receipt.save(update_fields=["sent_email"])
            return Response({"message": "Receipt sent successfully"})
        except Exception as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ─── dashboard ────────────────────────────────────────────────────────────────

class UpdateProfileView(views.APIView):
    """PATCH /auth/me/update/ — update name, email, password."""
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user
        user.first_name = request.data.get("first_name", user.first_name)
        user.last_name  = request.data.get("last_name",  user.last_name)
        user.email      = request.data.get("email",      user.email)

        new_password = request.data.get("new_password")
        if new_password:
            old_password = request.data.get("old_password", "")
            if not user.check_password(old_password):
                return Response({"error": "Current password is incorrect."}, status=400)
            user.set_password(new_password)

        user.save()
        return Response({"ok": True})


# ─── dashboard ────────────────────────────────────────────────────────────────

class DashboardView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business_id = request.query_params.get("business")
        if not business_id or not str(business_id).isdigit():
            return Response({"error": "A valid business ID is required."}, status=400)

        if not has_role(request.user, int(business_id), ["owner", "manager", "accountant"]):
            return Response({"error": "Access denied"}, status=403)

        try:
            business = Business.objects.get(id=business_id)
        except Business.DoesNotExist:
            return Response({"error": "Business not found"}, status=404)

        today = datetime.now().date()
        month_start = today.replace(day=1)
        week_start = today - timedelta(days=today.weekday())

        sales_today = Sale.objects.filter(business=business, date=today).aggregate(total=Sum("total_amount"))["total"] or 0
        sales_week = Sale.objects.filter(business=business, date__gte=week_start).aggregate(total=Sum("total_amount"))["total"] or 0
        sales_month = Sale.objects.filter(business=business, date__gte=month_start).aggregate(total=Sum("total_amount"))["total"] or 0
        expenses_today = Expense.objects.filter(business=business, date=today).aggregate(total=Sum("amount"))["total"] or 0
        expenses_month = Expense.objects.filter(business=business, date__gte=month_start).aggregate(total=Sum("amount"))["total"] or 0
        customer_balances = Customer.objects.filter(business=business).aggregate(total=Sum("outstanding_balance"))["total"] or 0
        supplier_balances = Supplier.objects.filter(business=business).aggregate(total=Sum("outstanding_balance"))["total"] or 0

        cash_in = CashBook.objects.filter(
            business=business,
            transaction_type__in=["sale", "customer_payment", "other_income"],
            date=today,
        ).aggregate(total=Sum("amount"))["total"] or 0
        cash_out = CashBook.objects.filter(
            business=business,
            transaction_type__in=["expense", "supplier_payment", "withdrawal"],
            date=today,
        ).aggregate(total=Sum("amount"))["total"] or 0
        cash_balance = cash_in - cash_out

        # Stock value = sum of physical_count for latest entry per product
        from django.db.models import Max
        latest_stock_dates = (
            StockCount.objects.filter(business=business)
            .values("product_name")
            .annotate(latest=Max("date"))
        )
        stock_value = 0
        for row in latest_stock_dates:
            entry = StockCount.objects.filter(
                business=business,
                product_name=row["product_name"],
                date=row["latest"],
            ).first()
            if entry:
                stock_value += float(entry.physical_count) * float(entry.unit_price)

        # Recent transactions
        recent_transactions = []
        for sale in Sale.objects.filter(business=business).order_by("-created_at")[:5]:
            recent_transactions.append({
                "type": "sale",
                "description": f"Sale {sale.receipt_number}",
                "amount": float(sale.total_amount),
                "date": sale.date.isoformat(),
            })
        for expense in Expense.objects.filter(business=business).order_by("-created_at")[:5]:
            recent_transactions.append({
                "type": "expense",
                "description": expense.description,
                "amount": float(expense.amount),
                "date": expense.date.isoformat(),
            })
        recent_transactions.sort(key=lambda x: x["date"], reverse=True)

        return Response({
            "sales_today": float(sales_today),
            "sales_week": float(sales_week),
            "sales_month": float(sales_month),
            "expenses_today": float(expenses_today),
            "expenses_month": float(expenses_month),
            "profit_month": float(sales_month) - float(expenses_month),
            "cash_balance": float(cash_balance),
            "customer_balances": float(customer_balances),
            "supplier_balances": float(supplier_balances),
            "stock_value": float(stock_value),
            "recent_transactions": recent_transactions[:10],
        })


# ─── reports ──────────────────────────────────────────────────────────────────

class SalesReportView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business_id = request.query_params.get("business")
        if not business_id or not str(business_id).isdigit():
            return Response({"error": "A valid business ID is required."}, status=400)

        if not has_role(request.user, int(business_id), ["owner", "manager", "accountant"]):
            return Response({"error": "Access denied"}, status=403)

        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")

        sales = Sale.objects.filter(business_id=business_id)
        if start_date:
            sales = sales.filter(date__gte=start_date)
        if end_date:
            sales = sales.filter(date__lte=end_date)

        daily = sales.values("date").annotate(total=Sum("total_amount"), count=Count("id")).order_by("date")
        weekly = (
            sales.annotate(week=TruncWeek("date"))
            .values("week")
            .annotate(total=Sum("total_amount"), count=Count("id"))
            .order_by("week")
        ) if sales.exists() else []
        monthly = sales.values("date__year", "date__month").annotate(total=Sum("total_amount"), count=Count("id")).order_by("date__year", "date__month")

        # Top selling items
        top_items = (
            SaleItem.objects.filter(sale__business_id=business_id, sale__in=sales)
            .values("item_name")
            .annotate(total_qty=Sum("quantity"), total_revenue=Sum("total"))
            .order_by("-total_revenue")[:10]
        )

        return Response({
            "daily": list(daily),
            "weekly": list(weekly),
            "monthly": list(monthly),
            "top_items": list(top_items),
        })


class ExpenseReportView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business_id = request.query_params.get("business")
        if not business_id or not str(business_id).isdigit():
            return Response({"error": "A valid business ID is required."}, status=400)

        if not has_role(request.user, int(business_id), ["owner", "manager", "accountant"]):
            return Response({"error": "Access denied"}, status=403)

        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")

        expenses = Expense.objects.filter(business_id=business_id)
        if start_date:
            expenses = expenses.filter(date__gte=start_date)
        if end_date:
            expenses = expenses.filter(date__lte=end_date)

        by_category = expenses.values("category__name").annotate(total=Sum("amount")).order_by("-total")
        daily = expenses.values("date").annotate(total=Sum("amount")).order_by("date")

        return Response({
            "by_category": list(by_category),
            "daily": list(daily),
        })


class ProfitReportView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business_id = request.query_params.get("business")
        if not business_id or not str(business_id).isdigit():
            return Response({"error": "A valid business ID is required."}, status=400)

        if not has_role(request.user, int(business_id), ["owner", "manager", "accountant"]):
            return Response({"error": "Access denied"}, status=403)

        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")

        sales = Sale.objects.filter(business_id=business_id)
        expenses = Expense.objects.filter(business_id=business_id)

        if start_date:
            sales = sales.filter(date__gte=start_date)
            expenses = expenses.filter(date__gte=start_date)
        if end_date:
            sales = sales.filter(date__lte=end_date)
            expenses = expenses.filter(date__lte=end_date)

        total_sales = sales.aggregate(total=Sum("total_amount"))["total"] or 0
        total_expenses = expenses.aggregate(total=Sum("amount"))["total"] or 0

        daily_profit = []
        dates = sorted(set(
            list(sales.values_list("date", flat=True).distinct()) +
            list(expenses.values_list("date", flat=True).distinct())
        ))
        for d in dates:
            day_sales = sales.filter(date=d).aggregate(total=Sum("total_amount"))["total"] or 0
            day_expenses = expenses.filter(date=d).aggregate(total=Sum("amount"))["total"] or 0
            daily_profit.append({
                "date": d.isoformat(),
                "sales": float(day_sales),
                "expenses": float(day_expenses),
                "profit": float(day_sales - day_expenses),
            })

        return Response({
            "total_sales": float(total_sales),
            "total_expenses": float(total_expenses),
            "profit": float(total_sales - total_expenses),
            "daily_profit": daily_profit,
        })


class StockReportView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business_id = request.query_params.get("business")
        if not business_id or not str(business_id).isdigit():
            return Response({"error": "A valid business ID is required."}, status=400)

        if not has_role(request.user, int(business_id), ["owner", "manager", "accountant"]):
            return Response({"error": "Access denied"}, status=403)

        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")

        counts = StockCount.objects.filter(business_id=business_id)
        if start_date:
            counts = counts.filter(date__gte=start_date)
        if end_date:
            counts = counts.filter(date__lte=end_date)

        by_date = counts.values("date").annotate(
            total_difference=Sum("difference"),
            count=Count("id"),
        ).order_by("date")

        by_product = counts.values("product_name").annotate(
            total_sold=Sum("quantity_sold"),
            total_difference=Sum("difference"),
        ).order_by("product_name")

        return Response({
            "by_date": list(by_date),
            "by_product": list(by_product),
        })
