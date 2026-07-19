-- Resolução do item ambíguo #101 da normalização de títulos de módulos
-- (20260719_normalizacao_titulos_modulos.sql): confirmado nas aulas do próprio
-- módulo ("Apresentando a ferramenta PJE Go", "Baixar o PJE GO e instalar") que
-- se trata da ferramenta PJe-Go, não do PJe-Calc (que já é o assunto do curso).
UPDATE modulos SET titulo = 'Ferramenta PJe-Go' WHERE id = 'bd081005-3d9c-4ddf-abe7-506b17ecc3b5';
