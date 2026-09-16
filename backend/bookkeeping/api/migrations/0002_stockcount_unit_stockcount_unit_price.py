from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="stockcount",
            name="unit",
            field=models.CharField(
                choices=[
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
                    ("other", "Other"),
                ],
                default="pcs",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="stockcount",
            name="unit_price",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
    ]
