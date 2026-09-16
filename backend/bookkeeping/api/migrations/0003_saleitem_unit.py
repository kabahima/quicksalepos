from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0002_stockcount_unit_stockcount_unit_price"),
    ]

    operations = [
        migrations.AddField(
            model_name="saleitem",
            name="unit",
            field=models.CharField(default="pcs", max_length=20),
        ),
    ]
