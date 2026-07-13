from django.db import migrations


def delete_anonymous_rows(apps, schema_editor):
    ChatSession = apps.get_model('chat', 'ChatSession')
    ResearchStats = apps.get_model('chat', 'ResearchStats')
    ChatSession.objects.filter(user__isnull=True).delete()
    ResearchStats.objects.filter(user__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0005_message_notion_url'),
    ]

    operations = [
        migrations.RunPython(delete_anonymous_rows, migrations.RunPython.noop),
    ]
