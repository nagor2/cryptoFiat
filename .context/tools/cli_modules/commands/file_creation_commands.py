"""
Команды создания файлов

Реализует команды: create-file, create-python, create-js, create-template

Версия: 1.0.0
Создано: 2025-01-28
"""

import json
import argparse
import os
from typing import Dict, List, Any, Optional
from pathlib import Path
import sys
from datetime import datetime

# Добавляем путь к модулям
sys.path.insert(0, str(Path(__file__).parent.parent))

from ..base_command import BaseCommand, ContextAwareCommand


class CreateFileCommand(ContextAwareCommand):
    """Команда create-file - создание отдельных файлов реализации"""
    
    def __init__(self, base_path: str):
        super().__init__(base_path)
        self.templates_dir = self.base_path / "templates" / "file_templates"
        self.templates_dir.mkdir(parents=True, exist_ok=True)
    
    @property
    def name(self) -> str:
        return "create-file"
    
    @property
    def description(self) -> str:
        return "Создать отдельный файл реализации (Python, JavaScript, etc.)"
    
    def add_arguments(self, parser: argparse.ArgumentParser):
        parser.add_argument(
            "file_path",
            help="Путь к создаваемому файлу (например: src/models/user.py)"
        )
        parser.add_argument(
            "--type", "-t",
            choices=["python", "javascript", "typescript", "json", "yaml", "markdown", "html", "css", "sql", "bash"],
            default="python",
            help="Тип файла для создания"
        )
        parser.add_argument(
            "--template", "-tmpl",
            help="Использовать конкретный шаблон (путь к файлу шаблона)"
        )
        parser.add_argument(
            "--class-name",
            help="Имя класса для Python файлов"
        )
        parser.add_argument(
            "--function-name",
            help="Имя функции для Python файлов"
        )
        parser.add_argument(
            "--description",
            help="Описание файла/компонента"
        )
        parser.add_argument(
            "--author",
            default="SLC System",
            help="Автор файла"
        )
        parser.add_argument(
            "--force", "-f",
            action="store_true",
            help="Перезаписать существующий файл"
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Показать содержимое файла без создания"
        )
    
    def execute_with_context(self, args: argparse.Namespace) -> Dict[str, Any]:
        """Выполнение команды create-file с JSON контекстом"""
        try:
            # Валидация аргументов
            if not self.validate_args(args):
                return {"success": False, "error": "Invalid arguments"}
            
            # Определяем тип файла
            file_type = args.type
            file_path = Path(args.file_path)
            
            # Создаем содержимое файла
            content = self._generate_file_content(args, file_type)
            
            # Проверяем существование файла
            if file_path.exists() and not args.force:
                return {
                    "success": False,
                    "error": f"File already exists: {file_path}. Use --force to overwrite."
                }
            
            # Создаем директории если нужно
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Если dry-run, только показываем содержимое
            if args.dry_run:
                print(f"📄 Содержимое файла {file_path}:")
                print("=" * 60)
                print(content)
                print("=" * 60)
                return {
                    "success": True,
                    "file_path": str(file_path),
                    "content_preview": content[:500] + "..." if len(content) > 500 else content,
                    "dry_run": True
                }
            
            # Записываем файл
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # Получаем статистику файла
            file_size = file_path.stat().st_size
            line_count = len(content.split('\n'))
            
            print(f"✅ Файл создан: {file_path}")
            print(f"   📊 Размер: {file_size} байт")
            print(f"   📝 Строк: {line_count}")
            print(f"   🏷️  Тип: {file_type}")
            
            return {
                "success": True,
                "file_path": str(file_path),
                "file_type": file_type,
                "file_size": file_size,
                "line_count": line_count,
                "created_at": datetime.now().isoformat(),
                "content_preview": content[:200] + "..." if len(content) > 200 else content
            }
            
        except Exception as e:
            error_msg = f"Ошибка создания файла: {str(e)}"
            self.print_error(error_msg)
            return {"success": False, "error": error_msg}
    
    def validate_args(self, args: argparse.Namespace) -> bool:
        """Валидация аргументов"""
        if not args.file_path:
            self.print_error("Путь к файлу обязателен")
            return False
        
        # Проверяем расширение файла
        file_path = Path(args.file_path)
        expected_extensions = {
            "python": ".py",
            "javascript": ".js",
            "typescript": ".ts",
            "json": ".json",
            "yaml": ".yml",
            "markdown": ".md",
            "html": ".html",
            "css": ".css",
            "sql": ".sql",
            "bash": ".sh"
        }
        
        expected_ext = expected_extensions.get(args.type, "")
        if expected_ext and not file_path.suffix == expected_ext:
            self.print_warning(f"Ожидаемое расширение для типа '{args.type}': {expected_ext}")
        
        return True
    
    def _generate_file_content(self, args: argparse.Namespace, file_type: str) -> str:
        """Генерирует содержимое файла на основе типа и аргументов"""
        
        if file_type == "python":
            return self._generate_python_file(args)
        elif file_type == "javascript":
            return self._generate_javascript_file(args)
        elif file_type == "typescript":
            return self._generate_typescript_file(args)
        elif file_type == "json":
            return self._generate_json_file(args)
        elif file_type == "yaml":
            return self._generate_yaml_file(args)
        elif file_type == "markdown":
            return self._generate_markdown_file(args)
        elif file_type == "html":
            return self._generate_html_file(args)
        elif file_type == "css":
            return self._generate_css_file(args)
        elif file_type == "sql":
            return self._generate_sql_file(args)
        elif file_type == "bash":
            return self._generate_bash_file(args)
        else:
            return self._generate_generic_file(args, file_type)
    
    def _generate_python_file(self, args: argparse.Namespace) -> str:
        """Генерирует Python файл"""
        file_name = Path(args.file_path).stem
        class_name = args.class_name or file_name.title().replace('_', '').replace('-', '')
        function_name = args.function_name or f"process_{file_name.lower()}"
        description = args.description or f"{class_name} implementation"
        
        content = f'''"""
{description}

This file was generated by SLC (Smart Layered Context) system.
Author: {args.author}
Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

import logging
from typing import Dict, Any, Optional, List
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)


class {class_name}:
    """
    {description}
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize {class_name}.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config or {{}}
        self.logger = logging.getLogger(f"{{__name__}}.{{self.__class__.__name__}}")
    
    def {function_name}(self, data: Any) -> Dict[str, Any]:
        """
        Process data using {class_name}.
        
        Args:
            data: Input data to process
            
        Returns:
            Processed data dictionary
        """
        try:
            self.logger.info(f"Processing data with {self.__class__.__name__}")
            
            # TODO: Implement processing logic
            result = {{
                "processed": True,
                "timestamp": datetime.now().isoformat(),
                "data": data
            }}
            
            self.logger.info(f"Processing completed successfully")
            return result
            
        except Exception as e:
            self.logger.error(f"Error processing data: {{e}}")
            raise
    
    def validate_config(self) -> bool:
        """
        Validate configuration.
        
        Returns:
            True if configuration is valid
        """
        # TODO: Implement validation logic
        return True
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get current status.
        
        Returns:
            Status dictionary
        """
        return {{
            "class": "{class_name}",
            "config_valid": self.validate_config(),
            "timestamp": datetime.now().isoformat()
        }}


def create_{file_name.lower()}() -> {class_name}:
    """
    Factory function to create {class_name} instance.
    
    Returns:
        {class_name} instance
    """
    return {class_name}()


if __name__ == "__main__":
    # Example usage
    processor = create_{file_name.lower()}()
    result = processor.{function_name}("test_data")
    print(f"Result: {{result}}")
'''
        return content
    
    def _generate_javascript_file(self, args: argparse.Namespace) -> str:
        """Генерирует JavaScript файл"""
        file_name = Path(args.file_path).stem
        class_name = args.class_name or file_name.title().replace('_', '').replace('-', '')
        function_name = args.function_name or f"process{class_name}"
        description = args.description or f"{class_name} implementation"
        
        content = f'''/**
 * {description}
 * 
 * This file was generated by SLC (Smart Layered Context) system.
 * Author: {args.author}
 * Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
 */

class {class_name} {{
    /**
     * Initialize {class_name}
     * @param {{Object}} config - Configuration object
     */
    constructor(config = {{}}) {{
        this.config = config;
        this.logger = console;
    }}
    
    /**
     * Process data using {class_name}
     * @param {{any}} data - Input data to process
     * @returns {{Object}} Processed data object
     */
    {function_name}(data) {{
        try {{
            this.logger.info(`Processing data with ${{this.constructor.name}}`);
            
            // TODO: Implement processing logic
            const result = {{
                processed: true,
                timestamp: new Date().toISOString(),
                data: data
            }};
            
            this.logger.info('Processing completed successfully');
            return result;
            
        }} catch (error) {{
            this.logger.error(`Error processing data: ${{error}}`);
            throw error;
        }}
    }}
    
    /**
     * Validate configuration
     * @returns {{boolean}} True if configuration is valid
     */
    validateConfig() {{
        // TODO: Implement validation logic
        return true;
    }}
    
    /**
     * Get current status
     * @returns {{Object}} Status object
     */
    getStatus() {{
        return {{
            class: '{class_name}',
            configValid: this.validateConfig(),
            timestamp: new Date().toISOString()
        }};
    }}
}}

/**
 * Factory function to create {class_name} instance
 * @returns {{Object}} {class_name} instance
 */
function create{class_name}() {{
    return new {class_name}();
}}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {{
    module.exports = {class_name};
    module.exports.create{class_name} = create{class_name};
}}

// Example usage
if (typeof window !== 'undefined') {{
    const processor = create{class_name}();
    const result = processor.{function_name}('test_data');
    console.log('Result:', result);
}}
'''
        return content
    
    def _generate_typescript_file(self, args: argparse.Namespace) -> str:
        """Генерирует TypeScript файл"""
        file_name = Path(args.file_path).stem
        class_name = args.class_name or file_name.title().replace('_', '').replace('-', '')
        function_name = args.function_name or f"process{class_name}"
        description = args.description or f"{class_name} implementation"
        
        content = f'''/**
 * {description}
 * 
 * Generated by SLC (Smart Layered Context) system
 * Author: {args.author}
 * Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
 */

interface Config {{
    [key: string]: any;
}}

interface ProcessResult {{
    processed: boolean;
    timestamp: string;
    data: any;
}}

interface Status {{
    class: string;
    configValid: boolean;
    timestamp: string;
}}

class {class_name} {{
    private config: Config;
    private logger: Console;
    
    /**
     * Initialize {class_name}
     * @param config - Configuration object
     */
    constructor(config: Config = {{}}) {{
        this.config = config;
        this.logger = console;
    }}
    
    /**
     * Process data using {class_name}
     * @param data - Input data to process
     * @returns Processed data object
     */
    {function_name}(data: any): ProcessResult {{
        try {{
            this.logger.info(`Processing data with ${{this.constructor.name}}`);
            
            // TODO: Implement processing logic
            const result: ProcessResult = {{
                processed: true,
                timestamp: new Date().toISOString(),
                data: data
            }};
            
            this.logger.info('Processing completed successfully');
            return result;
            
        }} catch (error) {{
            this.logger.error(`Error processing data: ${{error}}`);
            throw error;
        }}
    }}
    
    /**
     * Validate configuration
     * @returns True if configuration is valid
     */
    validateConfig(): boolean {{
        // TODO: Implement validation logic
        return true;
    }}
    
    /**
     * Get current status
     * @returns Status object
     */
    getStatus(): Status {{
        return {{
            class: '{class_name}',
            configValid: this.validateConfig(),
            timestamp: new Date().toISOString()
        }};
    }}
}}

/**
 * Factory function to create {class_name} instance
 * @returns {class_name} instance
 */
function create{class_name}(): {class_name} {{
    return new {class_name}();
}}

export {{ {class_name}, create{class_name} }};
export default {class_name};
'''
        return content
    
    def _generate_json_file(self, args: argparse.Namespace) -> str:
        """Генерирует JSON файл"""
        file_name = Path(args.file_path).stem
        description = args.description or f"{file_name} configuration"
        
        content = {
            "metadata": {
                "name": file_name,
                "description": description,
                "author": args.author,
                "created": datetime.now().isoformat(),
                "generator": "SLC (Smart Layered Context)"
            },
            "version": "1.0.0",
            "config": {
                "enabled": True,
                "debug": False,
                "timeout": 30
            },
            "settings": {
                "default_value": "example",
                "max_retries": 3,
                "log_level": "info"
            },
            "dependencies": [],
            "examples": [
                "Example configuration value",
                "Another example"
            ]
        }
        
        return json.dumps(content, indent=2, ensure_ascii=False)
    
    def _generate_yaml_file(self, args: argparse.Namespace) -> str:
        """Генерирует YAML файл"""
        file_name = Path(args.file_path).stem
        description = args.description or f"{file_name} configuration"
        
        content = f'''# {description}
# Generated by SLC (Smart Layered Context) system
# Author: {args.author}
# Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

metadata:
  name: {file_name}
  description: {description}
  author: {args.author}
  created: {datetime.now().isoformat()}
  generator: SLC (Smart Layered Context)

version: "1.0.0"

config:
  enabled: true
  debug: false
  timeout: 30

settings:
  default_value: "example"
  max_retries: 3
  log_level: "info"

dependencies: []

examples:
  - "Example configuration value"
  - "Another example"
'''
        return content
    
    def _generate_markdown_file(self, args: argparse.Namespace) -> str:
        """Генерирует Markdown файл"""
        file_name = Path(args.file_path).stem
        description = args.description or f"{file_name} documentation"
        
        content = f'''# {file_name}

{description}

## Overview

This file was generated by SLC (Smart Layered Context) system.

**Author:** {args.author}  
**Created:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Features

- Feature 1
- Feature 2
- Feature 3

## Usage

```bash
# Example usage
example_command
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| setting1 | value1 | Description 1 |
| setting2 | value2 | Description 2 |

## Examples

### Basic Example

```python
# Example code
print("Hello, World!")
```

### Advanced Example

```python
# More complex example
def process_data(data):
    return data.upper()
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.
'''
        return content
    
    def _generate_html_file(self, args: argparse.Namespace) -> str:
        """Генерирует HTML файл"""
        file_name = Path(args.file_path).stem
        description = args.description or f"{file_name} page"
        
        content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{file_name}</title>
    <meta name="description" content="{description}">
    <meta name="author" content="{args.author}">
    <meta name="generator" content="SLC (Smart Layered Context)">
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }}
        .metadata {{
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }}
        .metadata p {{
            margin: 5px 0;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{file_name}</h1>
        
        <div class="metadata">
            <p><strong>Description:</strong> {description}</p>
            <p><strong>Author:</strong> {args.author}</p>
            <p><strong>Created:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <p><strong>Generator:</strong> SLC (Smart Layered Context)</p>
        </div>
        
        <h2>Overview</h2>
        <p>This page was generated by SLC (Smart Layered Context) system.</p>
        
        <h2>Features</h2>
        <ul>
            <li>Feature 1</li>
            <li>Feature 2</li>
            <li>Feature 3</li>
        </ul>
        
        <h2>Usage</h2>
        <p>This is an example HTML page generated by SLC.</p>
        
        <script>
            // Example JavaScript
            console.log('Page loaded:', '{file_name}');
            
            // Add your JavaScript code here
            document.addEventListener('DOMContentLoaded', function() {{
                console.log('DOM fully loaded');
            }});
        </script>
    </div>
</body>
</html>'''
        return content
    
    def _generate_css_file(self, args: argparse.Namespace) -> str:
        """Генерирует CSS файл"""
        file_name = Path(args.file_path).stem
        description = args.description or f"{file_name} styles"
        
        content = f'''/*
 * {description}
 * 
 * Generated by SLC (Smart Layered Context) system
 * Author: {args.author}
 * Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
 */

/* Reset and base styles */
* {{
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}}

body {{
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f8f9fa;
}}

/* Container */
.{file_name}-container {{
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}}

/* Header */
.{file_name}-header {{
    background-color: #007bff;
    color: white;
    padding: 20px;
    text-align: center;
    border-radius: 8px 8px 0 0;
}}

.{file_name}-header h1 {{
    margin-bottom: 10px;
}}

/* Content */
.{file_name}-content {{
    background-color: white;
    padding: 30px;
    border-radius: 0 0 8px 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}}

/* Buttons */
.{file_name}-btn {{
    display: inline-block;
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    text-decoration: none;
    border-radius: 5px;
    border: none;
    cursor: pointer;
    transition: background-color 0.3s ease;
}}

.{file_name}-btn:hover {{
    background-color: #0056b3;
}}

.{file_name}-btn-secondary {{
    background-color: #6c757d;
}}

.{file_name}-btn-secondary:hover {{
    background-color: #545b62;
}}

/* Forms */
.{file_name}-form {{
    margin: 20px 0;
}}

.{file_name}-form-group {{
    margin-bottom: 15px;
}}

.{file_name}-form-label {{
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
}}

.{file_name}-form-input {{
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
}}

.{file_name}-form-input:focus {{
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 5px rgba(0,123,255,0.3);
}}

/* Responsive design */
@media (max-width: 768px) {{
    .{file_name}-container {{
        padding: 10px;
    }}
    
    .{file_name}-content {{
        padding: 20px;
    }}
}}'''
        return content
    
    def _generate_sql_file(self, args: argparse.Namespace) -> str:
        """Генерирует SQL файл"""
        file_name = Path(args.file_path).stem
        description = args.description or f"{file_name} database operations"
        
        content = f'''-- {description}
-- Generated by SLC (Smart Layered Context) system
-- Author: {args.author}
-- Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

-- Create table for {file_name}
CREATE TABLE IF NOT EXISTS {file_name} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_{file_name}_name ON {file_name}(name);
CREATE INDEX IF NOT EXISTS idx_{file_name}_created_at ON {file_name}(created_at);

-- Insert sample data
INSERT INTO {file_name} (name, description) VALUES 
    ('Sample Item 1', 'First sample item'),
    ('Sample Item 2', 'Second sample item'),
    ('Sample Item 3', 'Third sample item');

-- Select all items
SELECT * FROM {file_name} ORDER BY created_at DESC;

-- Update item
UPDATE {file_name} 
SET description = 'Updated description', updated_at = CURRENT_TIMESTAMP 
WHERE id = 1;

-- Delete item
DELETE FROM {file_name} WHERE id = 3;

-- Count total items
SELECT COUNT(*) as total_count FROM {file_name};
'''
        return content
    
    def _generate_bash_file(self, args: argparse.Namespace) -> str:
        """Генерирует Bash файл"""
        file_name = Path(args.file_path).stem
        description = args.description or f"{file_name} script"
        
        content = f'''#!/bin/bash
# {description}
# Generated by SLC (Smart Layered Context) system
# Author: {args.author}
# Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

set -e  # Exit on any error

# Configuration
SCRIPT_NAME="{file_name}"
VERSION="1.0.0"
AUTHOR="{args.author}"

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Logging functions
log_info() {{
    echo -e "${{BLUE}}[INFO]${{NC}} $1"
}}

log_success() {{
    echo -e "${{GREEN}}[SUCCESS]${{NC}} $1"
}}

log_warning() {{
    echo -e "${{YELLOW}}[WARNING]${{NC}} $1"
}}

log_error() {{
    echo -e "${{RED}}[ERROR]${{NC}} $1"
}}

# Help function
show_help() {{
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -v, --version  Show version information"
    echo "  -d, --debug    Enable debug mode"
    echo ""
    echo "Description: {description}"
    echo "Author: $AUTHOR"
    echo "Version: $VERSION"
}}

# Version function
show_version() {{
    echo "$SCRIPT_NAME version $VERSION"
    echo "Author: $AUTHOR"
    echo "Generated by SLC (Smart Layered Context)"
}}

# Main function
main() {{
    log_info "Starting $SCRIPT_NAME"
    
    # TODO: Add your main logic here
    log_info "Processing..."
    
    # Example: Create a directory
    # mkdir -p /tmp/example
    
    # Example: Check if file exists
    # if [ -f "/path/to/file" ]; then
    #     log_success "File exists"
    # else
    #     log_warning "File does not exist"
    # fi
    
    log_success "Script completed successfully"
}}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--version)
            show_version
            exit 0
            ;;
        -d|--debug)
            set -x  # Enable debug mode
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main "$@"
'''
        return content
    
    def _generate_generic_file(self, args: argparse.Namespace, file_type: str) -> str:
        """Генерирует общий файл для неизвестных типов"""
        file_name = Path(args.file_path).stem
        description = args.description or f"{file_name} file"
        
        content = f'''# {description}
# Generated by SLC (Smart Layered Context) system
# Author: {args.author}
# Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
# File Type: {file_type}

# TODO: Add your {file_type} content here
# This is a generic template for {file_type} files

# Example content:
# - Configuration settings
# - Data structures
# - Processing logic
# - Documentation

# End of file
'''
        return content


class CreatePythonCommand(CreateFileCommand):
    """Команда create-python - создание Python файлов с предустановленными настройками"""
    
    @property
    def name(self) -> str:
        return "create-python"
    
    @property
    def description(self) -> str:
        return "Создать Python файл с предустановленными настройками"
    
    def add_arguments(self, parser: argparse.ArgumentParser):
        parser.add_argument(
            "file_path",
            help="Путь к создаваемому Python файлу (например: src/models/user.py)"
        )
        parser.add_argument(
            "--type", "-t",
            default="python",
            help="Тип файла (по умолчанию: python)"
        )
        parser.add_argument(
            "--class-name",
            help="Имя класса (по умолчанию: из имени файла)"
        )
        parser.add_argument(
            "--function-name",
            help="Имя основной функции (по умолчанию: process_<filename>)"
        )
        parser.add_argument(
            "--description",
            help="Описание класса/функции"
        )
        parser.add_argument(
            "--author",
            default="SLC System",
            help="Автор файла"
        )
        parser.add_argument(
            "--async",
            action="store_true",
            help="Создать асинхронную версию"
        )
        parser.add_argument(
            "--with-tests",
            action="store_true",
            help="Создать также файл тестов"
        )
        parser.add_argument(
            "--force", "-f",
            action="store_true",
            help="Перезаписать существующий файл"
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Показать содержимое файла без создания"
        )
    
    def execute_with_context(self, args: argparse.Namespace) -> Dict[str, Any]:
        """Выполнение команды create-python"""
        # Устанавливаем тип файла как Python
        args.type = "python"
        return super().execute_with_context(args)


class CreateJavaScriptCommand(CreateFileCommand):
    """Команда create-js - создание JavaScript файлов с предустановленными настройками"""
    
    @property
    def name(self) -> str:
        return "create-js"
    
    @property
    def description(self) -> str:
        return "Создать JavaScript файл с предустановленными настройками"
    
    def add_arguments(self, parser: argparse.ArgumentParser):
        parser.add_argument(
            "file_path",
            help="Путь к создаваемому JavaScript файлу (например: src/utils/helper.js)"
        )
        parser.add_argument(
            "--type", "-t",
            default="javascript",
            help="Тип файла (по умолчанию: javascript)"
        )
        parser.add_argument(
            "--class-name",
            help="Имя класса (по умолчанию: из имени файла)"
        )
        parser.add_argument(
            "--function-name",
            help="Имя основной функции (по умолчанию: process<Filename>)"
        )
        parser.add_argument(
            "--description",
            help="Описание класса/функции"
        )
        parser.add_argument(
            "--author",
            default="SLC System",
            help="Автор файла"
        )
        parser.add_argument(
            "--module",
            action="store_true",
            help="Создать ES6 модуль"
        )
        parser.add_argument(
            "--force", "-f",
            action="store_true",
            help="Перезаписать существующий файл"
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Показать содержимое файла без создания"
        )
    
    def execute_with_context(self, args: argparse.Namespace) -> Dict[str, Any]:
        """Выполнение команды create-js"""
        # Устанавливаем тип файла как JavaScript
        args.type = "javascript"
        return super().execute_with_context(args) 