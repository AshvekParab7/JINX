from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='ActivitySnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mode', models.CharField(default='simulated', max_length=32)),
                ('activity', models.CharField(max_length=64)),
                ('confidence', models.PositiveSmallIntegerField(default=0)),
                ('source', models.CharField(default='mobile', max_length=32)),
                ('sensor_payload', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='FallEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('contact_number', models.CharField(blank=True, max_length=32)),
                ('mode', models.CharField(default='simulated', max_length=32)),
                ('activity', models.CharField(blank=True, max_length=64)),
                ('confidence', models.PositiveSmallIntegerField(default=0)),
                ('severity', models.CharField(default='Normal', max_length=24)),
                ('source', models.CharField(default='mobile', max_length=32)),
                ('auto_alert_triggered', models.BooleanField(default=False)),
                ('notes', models.TextField(blank=True)),
                ('sensor_payload', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]