from django.shortcuts import render

# Create your views here.


# views.py
def suggest_next_word(request):
    user_input = request.GET.get('text')
    # Use an NLP library like Spacy or a lightweight LLM here
    suggestion = get_nlp_prediction(user_input) 
    return JsonResponse({'suggestion': suggestion})