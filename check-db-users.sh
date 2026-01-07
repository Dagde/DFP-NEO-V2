#!/bin/bash

PGPASSWORD="WxMnHCNEfpTRYbVOTgOXjMykwHNhCqFw" psql -h caboose.proxy.rlwy.net -p 15652 -U postgres -d railway -c "SELECT &quot;userId&quot;, &quot;username&quot;, &quot;email&quot;, &quot;role&quot;, &quot;firstName&quot;, &quot;lastName&quot;, &quot;isActive&quot; FROM &quot;User&quot;;"