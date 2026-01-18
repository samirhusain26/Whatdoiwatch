from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('api/genres/', views.genres, name='genres'),
    path('api/movies/', views.movies, name='movies'),
    path('api/search/', views.search, name='search'),
    path('api/recommendations/', views.recommendations, name='recommendations'),
]
