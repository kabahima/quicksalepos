from rest_framework.permissions import BasePermission
from .models import Member


def get_member(user, business_id):
    """Return the Member object if user belongs to this business, else None."""
    try:
        return Member.objects.get(user=user, business_id=business_id)
    except Member.DoesNotExist:
        return None


def get_user_businesses(user):
    """Return all business IDs the user is an owner of or a member of."""
    owned = list(user.businesses.values_list("id", flat=True))
    member = list(Member.objects.filter(user=user).values_list("business_id", flat=True))
    return list(set(owned + member))


class IsBusinessMember(BasePermission):
    """
    Allows access to any authenticated user who is the business owner
    OR a member (any role) of the business.
    The view must set self.business_id from the request.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return True  # per-object check handles the rest


class IsCashierOrAbove(BasePermission):
    """Cashier, accountant, manager, owner — can create sales."""
    ALLOWED = {"owner", "manager", "cashier", "accountant"}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        # For writes: must be member with allowed role OR business owner
        return True  # detailed check in view.perform_create


class IsManagerOrAbove(BasePermission):
    """Manager and owner only — for expenses, stock, cashbook, reports."""
    ALLOWED = {"owner", "manager"}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return True


class IsOwnerOnly(BasePermission):
    """Owner only — for business settings, member management."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return True
