import sys, os
sys.path.insert(0, os.path.abspath('..\\sp\\Lib\\site-packages\\sphinxcontrib\\soliditydomain\\'))
sys.path.insert(0, os.path.abspath('..'))
#("D:\\YandexDisk\\Работа\\ICO\\CryptoFiat\\repo\\sp\\Lib\\site-packages\\")
# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = 'dotflat'
copyright = '2024, Dmitry Nagornykh'
author = 'Dmitry Nagornykh'

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = ['sphinx.ext.autosummary', "myst_parser", 'sphinx.ext.autodoc', 'sphinxcontrib.jquery', 'sphinxcontrib.soliditydomain']
templates_path = ['_templates']
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']


html_logo = "_static/logo.png"

#autodoc_default_flags = ['members'] - not working with contracts
#autosummary_generate = True

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'sphinx_rtd_theme'
html_static_path = ['_static']


html_theme_options = { "collapse_navigation" : False }

