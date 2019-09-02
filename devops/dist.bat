@ECHO OFF

rmdir /s /q dist
echo -
mkdir dist
mkdir dist\nodes
mkdir dist\src
echo -

copy index.htm dist
xcopy /s /q nodes dist\nodes
xcopy /s /q src dist\src

echo -
echo Distribution created!