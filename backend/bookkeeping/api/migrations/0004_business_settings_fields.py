from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0003_saleitem_unit"),
    ]

    operations = [
        migrations.AddField(
            model_name="business",
            name="currency",
            field=models.CharField(
                choices=[
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
                ],
                default="USD",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="business",
            name="currency_symbol",
            field=models.CharField(default="$", max_length=5),
        ),
        migrations.AddField(
            model_name="business",
            name="timezone",
            field=models.CharField(
                choices=[
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
                ],
                default="UTC",
                max_length=60,
            ),
        ),
        migrations.AddField(
            model_name="business",
            name="tax_rate",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5,
                                      help_text="Tax percentage e.g. 16 for 16%"),
        ),
        migrations.AddField(
            model_name="business",
            name="low_stock_threshold",
            field=models.PositiveIntegerField(default=5,
                                              help_text="Alert when stock falls below this number"),
        ),
        migrations.AddField(
            model_name="business",
            name="receipt_header",
            field=models.CharField(blank=True, max_length=255,
                                   help_text="Extra line shown at top of receipt"),
        ),
        migrations.AddField(
            model_name="business",
            name="receipt_footer",
            field=models.CharField(blank=True, max_length=255,
                                   help_text="Shown at bottom of receipt"),
        ),
        migrations.AddField(
            model_name="business",
            name="receipt_show_tax",
            field=models.BooleanField(default=False),
        ),
    ]
