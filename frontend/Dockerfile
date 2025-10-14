FROM nginx:alpine


COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html body.css javascript.js /usr/share/nginx/html/


# Expose port 80 (nginx default)
EXPOSE 80

# Nginx runs automatically