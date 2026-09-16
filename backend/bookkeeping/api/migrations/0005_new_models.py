from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0004_business_settings_fields"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── Station ──────────────────────────────────────────────────────
        migrations.CreateModel(
            name="Station",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("address", models.TextField(blank=True)),
                ("phone", models.CharField(blank=True, max_length=20)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="stations", to="api.business")),
                ("manager", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="managed_stations", to=settings.AUTH_USER_MODEL)),
            ],
            options={"unique_together": {("name", "business")}},
        ),
        # ── ProductCategory ───────────────────────────────────────────────
        migrations.CreateModel(
            name="ProductCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="product_categories", to="api.business")),
            ],
            options={"unique_together": {("name", "business")}},
        ),
        # ── Brand ─────────────────────────────────────────────────────────
        migrations.CreateModel(
            name="Brand",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="brands", to="api.business")),
                ("category", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="brands", to="api.productcategory")),
            ],
            options={"unique_together": {("name", "business")}},
        ),
        # ── Customer new fields ───────────────────────────────────────────
        migrations.AddField(
            model_name="customer",
            name="credit_limit",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12, help_text="Maximum credit allowed for this customer"),
        ),
        # ── CustomerPayment ───────────────────────────────────────────────
        migrations.CreateModel(
            name="CustomerPayment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("payment_method", models.CharField(choices=[("cash", "Cash"), ("mobile_money", "Mobile Money"), ("bank", "Bank"), ("card", "Card")], max_length=20)),
                ("reference", models.CharField(blank=True, max_length=255)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="customer_payments", to="api.business")),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ("customer", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payments", to="api.customer")),
            ],
        ),
        # ── Member stations M2M ───────────────────────────────────────────
        migrations.AddField(
            model_name="member",
            name="stations",
            field=models.ManyToManyField(blank=True, related_name="members", to="api.station"),
        ),
        # ── Sale station FK ───────────────────────────────────────────────
        migrations.AddField(
            model_name="sale",
            name="station",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sales", to="api.station"),
        ),
        # ── StockCount new fields ─────────────────────────────────────────
        migrations.AddField(
            model_name="stockcount",
            name="category",
            field=models.CharField(
                choices=[("groceries","Groceries"),("beverages","Beverages"),("snacks","Snacks"),("personal_care","Personal Care"),("household","Household"),("electronics","Electronics"),("clothing","Clothing"),("other","Other")],
                default="other", max_length=50,
            ),
        ),
        migrations.AddField(
            model_name="stockcount",
            name="brand",
            field=models.CharField(
                choices=[("generic","Generic"),("colgate","Colgate"),("oral_b","Oral-B"),("pepsodent","Pepsodent"),("close_up","Close-Up"),("nivea","Nivea"),("dove","Dove"),("lux","Lux"),("lifebuoy","Lifebuoy"),("ariel","Ariel"),("tide","Tide"),("omo","Omo"),("always","Always"),("whisper","Whisper"),("pampers","Pampers"),("huggies","Huggies"),("nestle","Nestlé"),("coca_cola","Coca-Cola"),("pepsi","Pepsi"),("sprite","Sprite"),("fanta","Fanta"),("kinley","Kinley"),("unilever","Unilever"),("procter","Procter & Gamble"),("other","Other")],
                default="generic", max_length=50,
            ),
        ),
    ]
