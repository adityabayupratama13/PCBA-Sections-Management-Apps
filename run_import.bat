@echo off
docker exec -i giken-mysql mysql -uroot -proot hardware -f -v -e "source /hardware_complete.sql;" > C:\Users\SERVER\Downloads\IT\mysql_verbose.log 2>&1
