package com.engine.editor.controller;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

/**
 * Forwards all browser navigation requests (non-API, non-static-file) to
 * index.html so that React Router can handle client-side routing.
 *
 * The "produces" constraint ensures only requests that accept text/html are
 * matched — fetch/XHR API calls (which send Accept: application/json) pass
 * through to the real controllers.
 */
@Controller
public class SpaController {

    @RequestMapping(
        value = {
            "/",
            "/{a:[^\\.]*}",
            "/{a:[^\\.]*}/{b:[^\\.]*}",
            "/{a:[^\\.]*}/{b:[^\\.]*}/{c:[^\\.]*}",
            "/{a:[^\\.]*}/{b:[^\\.]*}/{c:[^\\.]*}/{d:[^\\.]*}"
        },
        method = RequestMethod.GET,
        produces = MediaType.TEXT_HTML_VALUE
    )
    public String forward() {
        return "forward:/index.html";
    }
}
